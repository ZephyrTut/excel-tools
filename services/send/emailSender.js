"use strict";
const nodemailer = require("nodemailer");
const path = require("node:path");

/**
 * 发送邮件（支持抄送和附件）
 * @param {object} params
 * @param {object} params.smtpConfig - { host, port, secure, user, pass }
 * @param {string[]} params.to - 收件人列表
 * @param {string[]} params.cc - 抄送人列表（可为空数组）
 * @param {string} params.subject - 邮件主题
 * @param {Array<{filePath: string, mappedName: string}>} params.attachments - 附件列表
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
async function sendEmail({ smtpConfig, to, cc, subject, attachments }) {
  const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure !== false,
    auth: {
      user: smtpConfig.user,
      pass: smtpConfig.pass,
    },
  });

  const mailAttachments = (attachments || []).map((att) => ({
    filename: att.mappedName || path.basename(att.filePath),
    path: att.filePath,
  }));

  try {
    const info = await transporter.sendMail({
      from: smtpConfig.user,
      to: (to || []).join(", "),
      cc: (cc || []).join(", "),
      subject,
      attachments: mailAttachments,
    });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = { sendEmail };
