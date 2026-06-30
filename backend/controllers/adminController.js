const EmergencyRequest = require('../models/EmergencyRequest');
const EmergencyAnalysis = require('../models/EmergencyAnalysis');
const Assignment = require('../models/Assignment');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const SmsInbox = require('../models/SmsInbox');
const EvacuationShelter = require('../models/EvacuationShelter');

exports.verifyAndVerifyRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { manualPriority, status } = req.body;

    const request = await EmergencyRequest.findByPk(id, { include: [EmergencyAnalysis] });
    if (!request) return res.status(404).json({ message: 'Emergency request not found.' });

    if (manualPriority) {
      if (req.user.role !== 'Admin') {
        return res.status(403).json({ message: 'Access forbidden: Only Admins can modify triage priority parameters.' });
      }
      if (request.EmergencyAnalysis) {
        request.EmergencyAnalysis.priority = manualPriority;
        request.EmergencyAnalysis.requires_human_review = false;
        await request.EmergencyAnalysis.save();

        await AuditLog.create({
          request_id: request.id,
          action: 'Priority Override',
          details: `Manual triage override: priority updated to ${manualPriority} by user "${req.user.name}"`
        });
      }
    }

    if (status) {
      if (req.user.role === 'Responder' && !['Accepted', 'Completed'].includes(status)) {
        return res.status(403).json({ message: 'Access forbidden: Responders are restricted to Accepted or Completed mission vectors.' });
      }

      if (status === 'Verified' && request.EmergencyAnalysis) {
        const severity = request.EmergencyAnalysis.severity || 'Medium';
        if (severity === 'Low') {
          request.status = 'Submitted';
        } else {
          request.status = 'Verified';
        }
      } else {
        request.status = status;
      }
      
      await request.save();

      await AuditLog.create({
        request_id: request.id,
        action: 'Status Updated',
        details: `Incident status updated to: ${status} by user "${req.user.name}"`
      });
    }

    try {
      const updatedRequest = await EmergencyRequest.findByPk(request.id, {
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
        io.emit('requestUpdated', updatedRequest);
        if (updatedRequest.EmergencyAnalysis && ['Critical', 'High'].includes(updatedRequest.EmergencyAnalysis.priority) && (status === 'Verified' || status === 'Assigned')) {
          io.emit('geofencedAlert', {
            id: updatedRequest.id,
            category: updatedRequest.category,
            description: updatedRequest.description,
            latitude: parseFloat(updatedRequest.latitude),
            longitude: parseFloat(updatedRequest.longitude),
            priority: updatedRequest.EmergencyAnalysis.priority
          });
        }
      }
    } catch (socketErr) {
      console.error("Socket broadcast failed:", socketErr.message);
    }

    res.json({ message: 'Request status updated cleanly.', request });
  } catch (error) {
    res.status(500).json({ message: 'Failed to complete validation override.', error: error.message });
  }
};

exports.assignResponder = async (req, res) => {
  try {
    const { request_id, responder_id, department, departments } = req.body;

    const newAssignments = [];
    
    if (departments && Array.isArray(departments) && departments.length > 0) {
      for (const dept of departments) {
        const newAssignment = await Assignment.create({
          request_id,
          responder_id,
          department: dept,
          status: 'Assigned'
        });
        newAssignments.push(newAssignment);
      }
    } else if (department) {
      const newAssignment = await Assignment.create({
        request_id,
        responder_id,
        department,
        status: 'Assigned'
      });
      newAssignments.push(newAssignment);
    } else {
      return res.status(400).json({ message: 'No tactical department specified for assignment.' });
    }

    await EmergencyRequest.update({ status: 'Assigned' }, { where: { id: request_id } });

    try {
      const responder = await User.findByPk(responder_id);
      const responderName = responder ? responder.name : 'Unknown Unit';
      const deptList = (departments && Array.isArray(departments) && departments.length > 0) ? departments.join(', ') : department;
      await AuditLog.create({
        request_id,
        action: 'Dispatched',
        details: `Unit "${responderName}" manually dispatched to tactical departments: ${deptList} by user "${req.user.name}"`
      });
    } catch (auditErr) {
      console.error("Failed to write dispatch audit log:", auditErr.message);
    }

    try {
      const updatedRequest = await EmergencyRequest.findByPk(request_id, {
        include: [
          { model: EmergencyAnalysis },
          {
            model: Assignment,
            include: [{ model: User, attributes: ['id', 'name', 'phone'] }]
          }
        ]
      });
      const io = req.app.get('io');
      if (io) io.emit('requestUpdated', updatedRequest);
    } catch (socketErr) {
      console.error("Socket broadcast failed:", socketErr.message);
    }

    res.status(201).json({ 
      message: 'Responder dispatch vector locked and sent successfully.', 
      assignments: newAssignments 
    });
  } catch (error) {
    res.status(500).json({ message: 'Dispatch configuration failed.', error: error.message });
  }
};

exports.getResponders = async (req, res) => {
  try {
    const { Sequelize } = require('sequelize');
    const responders = await User.findAll({ 
      where: { role: 'Responder' }, 
      attributes: [
        'id', 
        'name', 
        'phone',
        [
          Sequelize.literal(`(
            SELECT COUNT(*) 
            FROM assignments AS a 
            WHERE a.responder_id = User.id AND a.status != 'Completed'
          )`),
          'activeMissionsCount'
        ]
      ]
    });
    res.json(responders);
  } catch (error) {
    res.status(500).json({ message: 'Failed to capture responders registry.', error: error.message });
  }
};

exports.getSmsInbox = async (req, res) => {
  try {
    const messages = await SmsInbox.findAll({
      order: [['created_at', 'DESC']]
    });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Failed to retrieve SMS inbox.', error: error.message });
  }
};

exports.simulateSms = async (req, res) => {
  try {
    const { sender_phone, raw_message } = req.body;
    if (!sender_phone || !raw_message) {
      return res.status(400).json({ message: 'sender_phone and raw_message are required.' });
    }
    const message = await SmsInbox.create({ sender_phone, raw_message, status: 'Pending' });
    res.status(201).json({ message: 'SMS simulated successfully.', sms: message });
  } catch (error) {
    res.status(500).json({ message: 'Failed to simulate SMS.', error: error.message });
  }
};

exports.ingestSms = async (req, res) => {
  try {
    const { id } = req.params;
    const sms = await SmsInbox.findByPk(id);
    if (!sms) return res.status(404).json({ message: 'SMS record not found.' });

    let parsedData = null;
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY_HERE') {
      try {
        const { GoogleGenAI } = require('@google/genai');
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        
        const prompt = `
          You are an advanced Emergency SMS Ingestion Parser for ResQNet.
          Analyze this raw SMS text message sent during a cellular outage:
          "${sms.raw_message}"

          Extract and structure the emergency details into a valid raw JSON object matching the schema below exactly.
          Do not include any markdown code wrappers (no \`\`\`json blocks), formatting indicators, or additional prose.

          Triage rules:
          - category: Must be one of: "Flood", "Fire Emergency", "Medical Crisis", "Earthquake", "Building Collapse", or "Others".
          - description: A clean description of the event. If the text is brief, expand or clean it up slightly to form a descriptive report.
          - people_count: Estimated number of trapped/impacted victims (default to 1 if unspecified).
          - latitude: Numeric latitude coordinate. If the text has no coordinates, estimate coordinates near Cochin/Kochi (between 9.93 and 9.99 latitude).
          - longitude: Numeric longitude coordinate. If the text has no coordinates, estimate coordinates near Cochin/Kochi (between 76.25 and 76.32 longitude).
          - landmark: A landmark if mentioned (or null).

          JSON Schema:
          {
            "category": "Flood" | "Fire Emergency" | "Medical Crisis" | "Earthquake" | "Building Collapse" | "Others",
            "description": "Clean description text",
            "people_count": <integer>,
            "latitude": <float>,
            "longitude": <float>,
            "landmark": "landmark string or null"
          }
        `;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [prompt],
          config: { responseMimeType: 'application/json' }
        });

        let cleanText = response.text.trim();
        if (cleanText.startsWith("```")) {
          cleanText = cleanText.replace(/^```(json)?/, "").replace(/```$/, "").trim();
        }
        parsedData = JSON.parse(cleanText);
      } catch (aiErr) {
        console.error("Gemini SMS parsing failed, falling back to format check:", aiErr.message);
      }
    }

    if (!parsedData) {
      const parts = sms.raw_message.split('|');
      if (parts[0] === 'RESQNET') {
        const cat = parts[1] || 'Others';
        const countPart = parts[2] || 'Count:1';
        const latPart = parts[3] || 'Lat:9.9312';
        const lngPart = parts[4] || 'Lng:76.2673';

        parsedData = {
          category: cat,
          description: `Offline SMS report: ${sms.raw_message}`,
          people_count: parseInt(countPart.replace('Count:', '')) || 1,
          latitude: parseFloat(latPart.replace('Lat:', '')) || 9.9312,
          longitude: parseFloat(lngPart.replace('Lng:', '')) || 76.2673,
          landmark: 'SMS Mesh Uplink'
        };
      } else {
        parsedData = {
          category: 'Others',
          description: `SOS via SMS from ${sms.sender_phone}: "${sms.raw_message}"`,
          people_count: 1,
          latitude: 9.9312,
          longitude: 76.2673,
          landmark: 'SMS Cellular Tower'
        };
      }
    }

    const request = await EmergencyRequest.create({
      category: parsedData.category,
      description: parsedData.description,
      people_count: parsedData.people_count,
      latitude: parsedData.latitude,
      longitude: parsedData.longitude,
      landmark: parsedData.landmark || 'SMS Ingested',
      status: 'Submitted',
      user_id: 1
    });

    let triageResult = { priority: 'High', severity: 'Medium', confidence: 60, reason: 'AI Triage from SMS intake.' };
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY_HERE') {
      try {
        const { GoogleGenAI } = require('@google/genai');
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const triagePrompt = `
          Triage this SMS emergency report:
          Category: ${parsedData.category}
          Description: ${parsedData.description}
          People Impacted: ${parsedData.people_count}

          Respond with a valid raw JSON object matching the sample block below exactly.
          {
            "priority": "Critical" | "High" | "Medium" | "Low",
            "severity": "High" | "Medium" | "Low",
            "confidence": <integer percentage from 0 to 100>,
            "reason": "1-2 sentence logical justification."
          }
        `;
        const resp = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [triagePrompt],
          config: { responseMimeType: 'application/json' }
        });
        let cText = resp.text.trim();
        if (cText.startsWith("```")) {
          cText = cText.replace(/^```(json)?/, "").replace(/```$/, "").trim();
        }
        triageResult = JSON.parse(cText);
      } catch (e) {
        console.error("Gemini SMS Triage failed:", e.message);
      }
    }

    await EmergencyAnalysis.create({
      request_id: request.id,
      priority: triageResult.priority || 'High',
      severity: triageResult.severity || 'Medium',
      confidence: triageResult.confidence || 60,
      reason: triageResult.reason || 'SMS ingestion completed.',
      requires_human_review: true
    });

    await AuditLog.create({
      request_id: request.id,
      action: 'Reported',
      details: `SOS ingested via SMS Gateway (${sms.sender_phone}). Description: "${parsedData.description}".`
    });

    sms.status = 'Ingested';
    await sms.save();

    const fullRequest = await EmergencyRequest.findByPk(request.id, {
      include: [
        { model: EmergencyAnalysis },
        { model: Assignment }
      ]
    });
    const io = req.app.get('io');
    if (io) {
      io.emit('newRequest', fullRequest);
    }

    res.json({ message: 'SMS successfully parsed, triaged, and ingested.', request: fullRequest });
  } catch (error) {
    res.status(500).json({ message: 'SMS ingestion failed.', error: error.message });
  }
};

exports.createShelter = async (req, res) => {
  try {
    const { name, latitude, longitude, capacity, occupied } = req.body;
    if (!name || !latitude || !longitude || !capacity) {
      return res.status(400).json({ message: 'All shelter parameters are required.' });
    }
    const shelter = await EvacuationShelter.create({ name, latitude, longitude, capacity, occupied });
    res.status(201).json({ message: 'Evacuation shelter registered successfully.', shelter });
  } catch (error) {
    res.status(500).json({ message: 'Failed to register shelter.', error: error.message });
  }
};

exports.updateShelterOccupancy = async (req, res) => {
  try {
    const { id } = req.params;
    const { occupied } = req.body;
    const shelter = await EvacuationShelter.findByPk(id);
    if (!shelter) return res.status(404).json({ message: 'Evacuation shelter not found.' });

    shelter.occupied = occupied;
    await shelter.save();
    res.json({ message: 'Shelter occupancy updated successfully.', shelter });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update shelter occupancy.', error: error.message });
  }
};