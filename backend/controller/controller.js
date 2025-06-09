const FacialAuthModel = require("../model/model");

module.exports = {
  async checkHealth(req, res) {
    return FacialAuthModel.checkHealth(req, res);
  },

  async registerUser(req, res) {
    return FacialAuthModel.register(req, res);
  },

  async loginSession(req, res) {
    return FacialAuthModel.login(req, res);
  },

  async logoutSession(req, res) {
    return FacialAuthModel.logout(req, res);
  },

  async enrollFace(req, res) {
    return FacialAuthModel.enrollFace(req, res);
  },

  async faceLogin(req, res) {
    return FacialAuthModel.faceLogin(req, res);
  },

  async getUserProfile(req, res) {
    return FacialAuthModel.getUserProfile(req, res);
  },

  async getDashboardStats(req, res) {
    return FacialAuthModel.getDashboardStats(req, res);
  },

  async deleteBiometricData(req, res) {
    return FacialAuthModel.deleteBiometricData(req, res);
  },
};
