const EmergencyRequest = require('../models/EmergencyRequest');
const EmergencyAnalysis = require('../models/EmergencyAnalysis');
const Assignment = require('../models/Assignment');
const User = require('../models/User');

// 1. UPDATE PRIORITY AND STATUS (HUMAN INTERVENTION GATE)
exports.verifyAndVerifyRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { manualPriority, status } = req.body;

    const request = await EmergencyRequest.findByPk(id, { include: [EmergencyAnalysis] });
    if (!request) return res.status(404).json({ message: 'Emergency request not found.' });

    // Role-based validation constraints
    if (manualPriority) {
      if (req.user.role !== 'Admin') {
        return res.status(403).json({ message: 'Access forbidden: Only Admins can modify triage priority parameters.' });
      }
      if (request.EmergencyAnalysis) {
        request.EmergencyAnalysis.priority = manualPriority;
        // Mark as reviewed since a human just interacted with it
        request.EmergencyAnalysis.requires_human_review = false;
        await request.EmergencyAnalysis.save();
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
    }

    await request.save();

    res.json({ message: 'Request status updated cleanly.', request });
  } catch (error) {
    res.status(500).json({ message: 'Failed to complete validation override.', error: error.message });
  }
};

// 2. DISPATCH RESPONDER TARGET MATRIX
exports.assignResponder = async (req, res) => {
  try {
    const { request_id, responder_id, department } = req.body;

    const newAssignment = await Assignment.create({
      request_id,
      responder_id,
      department,
      status: 'Assigned'
    });

    // Automatically transition the main request profile tracking state
    await EmergencyRequest.update({ status: 'Assigned' }, { where: { id: request_id } });

    res.status(201).json({ message: 'Responder dispatch vector locked and sent successfully.', newAssignment });
  } catch (error) {
    res.status(500).json({ message: 'Dispatch configuration failed.', error: error.message });
  }
};

// 3. GET LIST OF ALL VERIFIED FIELD RESPONDERS
exports.getResponders = async (req, res) => {
  try {
    const responders = await User.findAll({ 
      where: { role: 'Responder' }, 
      attributes: ['id', 'name', 'phone'] 
    });
    res.json(responders);
  } catch (error) {
    res.status(500).json({ message: 'Failed to capture responders registry.', error: error.message });
  }
};