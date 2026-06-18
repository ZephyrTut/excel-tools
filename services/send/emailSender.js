"use strict";
const nodemailer = require("nodemailer");
const path = require("node:path");

/**
 * 将地址对象或字符串转为 nodemailer 地址格式
 * 支持 { name, address } 对象和纯字符串
 */
function toAddress(addr) {
  if (typeof addr === "string") return addr;
  if (addr && addr.address) {
    return addr.name ? `"${addr.name}" <${addr.address}>` : addr.address;
  }
  return "";
}

/**
 * 发送邮件（支持抄送和附件）
 * @param {object} params
 * @param {object} params.smtpConfig - { host, port, secure, user, pass }
 * @param {Array<{name: string|null, address: string}>} params.to - 收件人列表
 * @param {Array<{name: string|null, address: string}>} params.cc - 抄送人列表
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

  const mailAttachments = (attachments || []).map((att) => {
    const rawName = att.mappedName || path.basename(att.filePath);
    const nameWithoutExt = path.parse(rawName).name;
    return {
      filename: nameWithoutExt + ".xlsx",
      path: att.filePath,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  });

  try {
    const info = await transporter.sendMail({
      from: smtpConfig.user,
      to: (to || []).map(toAddress).filter(Boolean).join(", "),
      cc: (cc || []).map(toAddress).filter(Boolean).join(", "),
      subject,
      attachments: mailAttachments,
    });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = { sendEmail };
