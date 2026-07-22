const pipelineService = require('../services/pipeline.service');
const ChatHistory = require('../models/ChatHistory');

class QueryController {
  async queryStream(req, res, next) {
    try {
      const { query, sessionId } = req.body;
      if (!query) {
        return res.status(400).json({ message: 'Query string is required' });
      }
      if (!sessionId) {
        return res.status(400).json({ message: 'Session ID is required' });
      }

      // Stream response using PipelineService
      await pipelineService.executeQueryStream({
        query,
        userId: req.user._id,
        sessionId,
        res,
      });
    } catch (error) {
      console.error('Query Stream Endpoint Error:', error);
      next(error);
    }
  }

  async getChatHistory(req, res, next) {
    try {
      const history = await ChatHistory.find({ userId: req.user._id })
        .sort({ createdAt: -1 })
        .limit(200);

      // Group by sessionId
      const sessions = {};
      history.forEach((item) => {
        if (!sessions[item.sessionId]) {
          sessions[item.sessionId] = [];
        }
        sessions[item.sessionId].push(item);
      });

      // Reverse each session's message array to chronological order (oldest first)
      Object.keys(sessions).forEach((sessionId) => {
        sessions[sessionId].reverse();
      });

      return res.status(200).json(sessions);
    } catch (error) {
      next(error);
    }
  }

  async deleteChatHistory(req, res, next) {
    try {
      const { sessionId } = req.params;
      await ChatHistory.deleteMany({ userId: req.user._id, sessionId });
      return res.status(200).json({ message: `Session ${sessionId} history deleted successfully` });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new QueryController();
