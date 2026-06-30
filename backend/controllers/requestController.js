const EmergencyRequest = require('../models/EmergencyRequest');
const EmergencyAnalysis = require('../models/EmergencyAnalysis');
const { GoogleGenAI } = require('@google/genai');
const Assignment = require('../models/Assignment');
const User = require('../models/User');
const fs = require('fs');

const aiEngineFallback = {
  priority: "High",
  severity: "Medium",
  confidence: 60,
  reason: "Automated standard threshold triage backup framework triggered.",
  requires_human_review: true
};

exports.submitRequest = async (req, res) => {
  try {
    const { category, description, people_count, landmark, latitude, longitude } = req.body;

    if (!category || !description || !people_count || !latitude || !longitude) {
      return res.status(400).json({ message: "Parameters category, description, people_count, latitude, longitude are required." });
    }

    const request = await EmergencyRequest.create({
      category,
      description,
      people_count,
      landmark,
      latitude,
      longitude,
      status: 'Submitted',
      image_path: req.file ? `/uploads/${req.file.filename}` : null,
      user_id: req.user.id
    });

    let aiAnalysisResult = { ...aiEngineFallback };

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
      aiAnalysisResult.reason = "Fallback: GEMINI_API_KEY is missing or not configured in backend .env file.";
    } else {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const prompt = `
          You are an advanced emergency dispatch AI triage unit for ResQNet.
          Analyze this crisis report (including any attached photo):
          Category: ${category}
          Description: ${description}
          People Impacted: ${people_count}
 
          Triage Criteria Instructions:
          - Priority:
            * "Critical": Immediate, severe life-threats. E.g., active fires with trapped victims, severe medical trauma (bleeding, unconsciousness), collapsed buildings, active flooding with people actively stranded.
            * "High": Urgent threat to health/property. E.g., rising flood waters inside a house, building damage, localized fires, acute illness without immediate arrest.
            * "Medium": Non-life-threatening incidents. E.g., road blockages, property flooding, minor injuries, utility failures.
            * "Low": Minor local issues. E.g., supply requests, minor water leaks, structural checks.
          - Severity: Choose "High" if immediate physical danger exists, "Medium" if support is needed quickly, and "Low" if non-urgent.
          - Confidence Score:
            * Assign 75% to 95% if the report description is clear, contains concrete indicators of the event, matches the category, and has verifiable details.
            * Assign less than 50% only if the description is highly vague, ambiguous, or lacks context (e.g. "help", "hello", "need something").
            This is critical because confidence >= 50% triggers automatic unit dispatches.
 
          Translation & Vision Task Instructions:
          - Translation: Determine if the Description text is written in a language other than English. If so, translate the entire Description to English and output it in the "translated_description" key. If it is already in English, output null.
          - Image Vision Labeling: If a photo is attached, analyze the visual hazards in the photo and extract up to 5 critical risk/hazard tags describing the situation shown (e.g., Smoke, Fire, Flood, Trauma, Water, Collapse, Debris). Output them as a string array in the "image_tags" key. If no photo is attached, output an empty array [].
 
          Respond with a valid raw JSON object matching the sample block below exactly. Do not provide markdown code wrappers (no \`\`\`json blocks), formatting indicators, or additional contextual prose.
 
          {
            "priority": "Critical" | "High" | "Medium" | "Low",
            "severity": "High" | "Medium" | "Low",
            "confidence": <integer percentage from 0 to 100>,
            "reason": "1-2 sentence logical justification linking situation descriptions to selected triage values.",
            "requires_human_review": <true if confidence is below 50, otherwise false>,
            "translated_description": "English translation string or null",
            "image_tags": ["tag1", "tag2", "tag3"]
          }
        `;

        const contents = [prompt];
        if (req.file) {
          contents.push({
            inlineData: {
              data: fs.readFileSync(req.file.path).toString("base64"),
              mimeType: req.file.mimetype
            }
          });
        }

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: contents,
          config: {
            responseMimeType: 'application/json'
          }
        });

        let cleanText = response.text.trim();
        if (cleanText.startsWith("```")) {
          cleanText = cleanText.replace(/^```(json)?/, "").replace(/```$/, "").trim();
        }
        aiAnalysisResult = JSON.parse(cleanText);
      } catch (aiErr) {
        console.error("Gemini API processing failure, triggering fallback:", aiErr.message);
        aiAnalysisResult.reason = `Fallback: Gemini API failed (${aiErr.message}).`;
      }
    }

    const { Op } = require('sequelize');
    const duplicateWindow = new Date(Date.now() - 60 * 60 * 1000);
    const existingActiveRequests = await EmergencyRequest.findAll({
      where: {
        category,
        status: { [Op.ne]: 'Completed' },
        created_at: { [Op.gt]: duplicateWindow },
        id: { [Op.ne]: request.id }
      }
    });

    let isDuplicate = false;
    for (const ext of existingActiveRequests) {
      const latDiff = Math.abs(parseFloat(ext.latitude) - parseFloat(latitude));
      const lngDiff = Math.abs(parseFloat(ext.longitude) - parseFloat(longitude));
      if (latDiff < 0.001 && lngDiff < 0.001) {
        isDuplicate = true;
        break;
      }
    }

    const validPriorities = ['Critical', 'High', 'Medium', 'Low'];
    const validSeverities = ['High', 'Medium', 'Low'];

    const sanitizedAnalysis = {
      priority: (aiAnalysisResult && validPriorities.includes(aiAnalysisResult.priority)) ? aiAnalysisResult.priority : 'High',
      severity: (aiAnalysisResult && validSeverities.includes(aiAnalysisResult.severity)) ? aiAnalysisResult.severity : 'Medium',
      confidence: (aiAnalysisResult && typeof aiAnalysisResult.confidence === 'number' && !isNaN(aiAnalysisResult.confidence))
        ? Math.min(100, Math.max(0, Math.round(aiAnalysisResult.confidence)))
        : 50,
      reason: (aiAnalysisResult && typeof aiAnalysisResult.reason === 'string' && aiAnalysisResult.reason.trim())
        ? (isDuplicate ? `⚠️ [DUPLICATE WARNING] A similar report was submitted nearby. ` : '') + aiAnalysisResult.reason.trim()
        : (isDuplicate ? `⚠️ [DUPLICATE WARNING] A similar report was submitted nearby. ` : '') + 'Automated triage processing completed.',
      requires_human_review: isDuplicate ? true : ((aiAnalysisResult && typeof aiAnalysisResult.requires_human_review === 'boolean')
        ? aiAnalysisResult.requires_human_review
        : false)
    };

    if (sanitizedAnalysis.confidence < 50) {
      sanitizedAnalysis.requires_human_review = true;
    }

    await EmergencyAnalysis.create({
      request_id: request.id,
      priority: sanitizedAnalysis.priority,
      severity: sanitizedAnalysis.severity,
      confidence: sanitizedAnalysis.confidence,
      reason: sanitizedAnalysis.reason,
      requires_human_review: sanitizedAnalysis.requires_human_review,
      translated_description: (aiAnalysisResult && typeof aiAnalysisResult.translated_description === 'string') ? aiAnalysisResult.translated_description : null,
      image_tags: (aiAnalysisResult && Array.isArray(aiAnalysisResult.image_tags) && aiAnalysisResult.image_tags.length > 0) ? aiAnalysisResult.image_tags.join(',') : null
    });

    if (sanitizedAnalysis.confidence >= 50 && !isDuplicate) {
      try {
        const responders = await User.findAll({ where: { role: 'Responder' } });
        if (responders.length > 0) {
          const categoryToDeptMap = {
            'Fire Emergency': 'Fire Force',
            'Flood': 'Disaster Response',
            'Medical Crisis': 'Paramedic',
            'Earthquake': 'Disaster Response',
            'Building Collapse': 'Disaster Response'
          };
          const department = categoryToDeptMap[category] || 'Volunteer';
 
          const activeAssignments = await Assignment.findAll({
            where: { status: { [Op.ne]: 'Completed' } }
          });
 
          const loadMap = {};
          responders.forEach(r => { loadMap[r.id] = 0; });
          activeAssignments.forEach(asg => {
            if (loadMap[asg.responder_id] !== undefined) {
              loadMap[asg.responder_id]++;
            }
          });
 
          const deptKeywords = {
            'Fire Force': ['fire', 'station', 'hose', 'rescue', 'alpha'],
            'Paramedic': ['paramedic', 'medical', 'hospital', 'ambulance', 'clinic'],
            'Police': ['police', 'sheriff', 'patrol', 'cop'],
            'Disaster Response': ['disaster', 'relief', 'hazard', 'earthquake', 'flood']
          };
 
          const keywords = deptKeywords[department] || [];
          const matchedResponders = responders.filter(r => {
            const nameLower = r.name.toLowerCase();
            return keywords.some(kw => nameLower.includes(kw));
          });
 
          const candidateList = matchedResponders.length > 0 ? matchedResponders : responders;
          candidateList.sort((a, b) => loadMap[a.id] - loadMap[b.id]);
          const selectedResponder = candidateList[0];
 
          await Assignment.create({
            request_id: request.id,
            responder_id: selectedResponder.id,
            department,
            status: 'Assigned'
          });
 
          request.status = 'Assigned';
          await request.save();
        }
      } catch (assignErr) {
        console.error("Auto-assignment routine failed:", assignErr.message);
      }
    }
 
    try {
      const AuditLog = require('../models/AuditLog');
      await AuditLog.create({
        request_id: request.id,
        action: 'Reported',
        details: `Emergency signal triaged by AI: priority "${sanitizedAnalysis.priority}", severity "${sanitizedAnalysis.severity}", confidence ${sanitizedAnalysis.confidence}%.`
      });
 
      if (request.status === 'Assigned') {
        await AuditLog.create({
          request_id: request.id,
          action: 'Auto-Assigned',
          details: `Incident automatically routed based on AI triage confidence threshold.`
        });
      }
    } catch (auditErr) {
      console.error("Failed to write submission audit log:", auditErr.message);
    }
 
    try {
      const fullRequest = await EmergencyRequest.findByPk(request.id, {
        include: [
          { model: EmergencyAnalysis },
          {
            model: Assignment,
            include: [{ model: User, attributes: ['id', 'name', 'phone'] }]
          }
        ]
      });
      const io = req.app.get('io');
      if (io) {
        io.emit('newRequest', fullRequest);
        if (fullRequest.EmergencyAnalysis && ['Critical', 'High'].includes(fullRequest.EmergencyAnalysis.priority) && fullRequest.EmergencyAnalysis.confidence >= 50) {
          io.emit('geofencedAlert', {
            id: fullRequest.id,
            category: fullRequest.category,
            description: fullRequest.description,
            latitude: parseFloat(fullRequest.latitude),
            longitude: parseFloat(fullRequest.longitude),
            priority: fullRequest.EmergencyAnalysis.priority
          });
        }
      }
    } catch (socketErr) {
      console.error("Socket broadcast failed:", socketErr.message);
    }

    res.status(201).json({
      message: "SOS Distress request successfully logged.",
      requestId: request.id,
      analysis: sanitizedAnalysis
    });

  } catch (error) {
    res.status(500).json({ message: "Request initialization loop crashed.", error: error.message });
  }
};

exports.getAllRequests = async (req, res) => {
  try {
    const whereClause = {};
    if (req.user.role === 'Citizen') {
      whereClause.user_id = req.user.id;
    }

    const requests = await EmergencyRequest.findAll({
      where: whereClause,
      include: [
        { model: EmergencyAnalysis },
        {
          model: Assignment,
          include: [{ model: User, attributes: ['id', 'name', 'phone'] }]
        }
      ]
    });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: "Failed to grab request records.", error: error.message });
  }
};
 
exports.getShelters = async (req, res) => {
  try {
    const EvacuationShelter = require('../models/EvacuationShelter');
    const shelters = await EvacuationShelter.findAll({
      order: [['name', 'ASC']]
    });
    res.json(shelters);
  } catch (error) {
    res.status(500).json({ message: 'Failed to retrieve evacuation shelters.', error: error.message });
  }
};
 
exports.getAuditLogs = async (req, res) => {
  try {
    const { id } = req.params;
    const AuditLog = require('../models/AuditLog');
    const logs = await AuditLog.findAll({
      where: { request_id: id },
      order: [['created_at', 'ASC']]
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: 'Failed to retrieve incident audit logs.', error: error.message });
  }
};