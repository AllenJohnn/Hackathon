const EmergencyRequest = require('../models/EmergencyRequest');
const EmergencyAnalysis = require('../models/EmergencyAnalysis');
const { GoogleGenAI } = require('@google/genai');
const Assignment = require('../models/Assignment');
const User = require('../models/User');
const fs = require('fs');

// Fallback configuration if Gemini key is unset or times out during live demo
const aiEngineFallback = {
  priority: "High",
  severity: "Medium",
  confidence: 45,
  reason: "Automated analysis timeout. Shifted to operator manual validation review queue.",
  requires_human_review: true
};

exports.submitRequest = async (req, res) => {
  try {
    const { category, description, people_count, latitude, longitude, landmark } = req.body;
    const user_id = req.user.id; // Pulled dynamically from active JWT authentication
    const image_path = req.file ? `/uploads/${req.file.filename}` : null;

    // 1. Create the persistent database record for the citizen input
    const request = await EmergencyRequest.create({
      user_id, category, description, people_count, latitude, longitude, landmark, image_path, status: 'Under Analysis'
    });

    // 2. Format a highly restrictive prompt instructions payload for Gemini
    let aiAnalysisResult = aiEngineFallback;
    
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY_HERE') {
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

          Respond with a valid raw JSON object matching the sample block below exactly. Do not provide markdown code wrappers (no \`\`\`json blocks), formatting indicators, or additional contextual prose.

          {
            "priority": "Critical" | "High" | "Medium" | "Low",
            "severity": "High" | "Medium" | "Low",
            "confidence": <integer percentage from 0 to 100>,
            "reason": "1-2 sentence logical justification linking situation descriptions to selected triage values.",
            "requires_human_review": <true if confidence is below 50, otherwise false>
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
        });

        let cleanText = response.text.trim();
        if (cleanText.startsWith("```")) {
          cleanText = cleanText.replace(/^```json/, "").replace(/```$/, "").trim();
        }
        aiAnalysisResult = JSON.parse(cleanText);
      } catch (aiErr) {
        console.error("Gemini API processing failure, triggering fallback:", aiErr.message);
      }
    }

    // Check for nearby duplicate incidents (same category within ~100m radius in the last 1 hour)
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

    // Sanitize and validate AI analysis results to prevent database constraints violations
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

    // Ensure the human review flag explicitly forces manual control if confidence dips
    if (sanitizedAnalysis.confidence < 50) {
      sanitizedAnalysis.requires_human_review = true;
    }

    // 3. Store the AI analysis result alongside the original request record
    await EmergencyAnalysis.create({
      request_id: request.id,
      priority: sanitizedAnalysis.priority,
      severity: sanitizedAnalysis.severity,
      confidence: sanitizedAnalysis.confidence,
      reason: sanitizedAnalysis.reason,
      requires_human_review: sanitizedAnalysis.requires_human_review
    });

    // 4. Auto-assign dispatch unit if confidence >= 50% and it's not a duplicate
    if (sanitizedAnalysis.confidence >= 50 && !isDuplicate) {
      try {
        const defaultResponder = await User.findOne({ where: { role: 'Responder' } });
        if (defaultResponder) {
          const categoryToDeptMap = {
            'Fire Emergency': 'Fire Force',
            'Flood': 'Disaster Response',
            'Medical Crisis': 'Paramedic',
            'Earthquake': 'Disaster Response',
            'Building Collapse': 'Disaster Response'
          };
          const department = categoryToDeptMap[category] || 'Volunteer';

          await Assignment.create({
            request_id: request.id,
            responder_id: defaultResponder.id,
            department,
            status: 'Assigned'
          });

          // Automatically transition the request status to Assigned
          request.status = 'Assigned';
          await request.save();
        }
      } catch (assignErr) {
        console.error("Auto-assignment routine failed:", assignErr.message);
      }
    }

    res.status(201).json({
      message: "Emergency request recorded and analyzed cleanly.",
      requestId: request.id,
      analysis: sanitizedAnalysis
    });

  } catch (error) {
    res.status(500).json({ message: "Request initialization loop crashed.", error: error.message });
  }
};

// GET ALL REQUESTS FOR ADMIN GRID VIEW & CITIZEN LOGS
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