const analyticsService = require('../services/analytics.service');
const FallbackLog = require('../models/FallbackLog');
const FaqCache = require('../models/FaqCache');

class AdminController {
  async getAnalytics(req, res, next) {
    try {
      const stats = await analyticsService.getDashboardAnalytics();
      return res.status(200).json(stats);
    } catch (error) {
      next(error);
    }
  }

  async getFallbackLogs(req, res, next) {
    try {
      const logs = await FallbackLog.find()
        .sort({ timestamp: -1 })
        .limit(100);
      return res.status(200).json(logs);
    } catch (error) {
      next(error);
    }
  }

  async getFAQs(req, res, next) {
    try {
      const faqs = await FaqCache.find().sort({ createdAt: -1 });
      return res.status(200).json(faqs);
    } catch (error) {
      next(error);
    }
  }

  async addFAQ(req, res, next) {
    try {
      const { question, answer, keywords } = req.body;
      if (!question || !answer) {
        return res.status(400).json({ message: 'Question and answer are required' });
      }

      // Convert keywords list
      const kwArray = keywords
        ? (Array.isArray(keywords) ? keywords : keywords.split(',')).map((k) => k.trim().toLowerCase())
        : [];

      const faq = await FaqCache.create({
        question: question.trim(),
        answer: answer.trim(),
        keywords: kwArray,
        isVerified: true,
      });

      return res.status(201).json(faq);
    } catch (error) {
      res.status(400);
      next(error);
    }
  }

  async deleteFAQ(req, res, next) {
    try {
      const { faqId } = req.params;
      const faq = await FaqCache.findByIdAndDelete(faqId);
      if (!faq) {
        return res.status(404).json({ message: 'FAQ not found' });
      }
      return res.status(200).json({ message: 'FAQ deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async getAllConversations(req, res, next) {
    try {
      const ChatHistory = require('../models/ChatHistory');
      const history = await ChatHistory.find()
        .populate('userId', 'username email')
        .sort({ createdAt: -1 })
        .limit(1000);

      // Group by sessionId
      const sessions = {};
      history.forEach((item) => {
        if (!sessions[item.sessionId]) {
          sessions[item.sessionId] = {
            sessionId: item.sessionId,
            user: item.userId ? {
              id: item.userId._id,
              username: item.userId.username,
              email: item.userId.email
            } : { username: 'Anonymous', email: '' },
            messages: [],
            updatedAt: item.createdAt
          };
        }
        sessions[item.sessionId].messages.push(item);
      });

      // Sort messages chronologically (oldest first) inside each session
      Object.keys(sessions).forEach((sid) => {
        sessions[sid].messages.reverse();
      });

      // Convert to array and sort by latest updated session first
      const sessionList = Object.values(sessions).sort((a, b) => b.updatedAt - a.updatedAt);

      return res.status(200).json(sessionList);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AdminController();
