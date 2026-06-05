"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMail = exports.initMail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
let transporter = null;
let isEthereal = false;
const initMail = async () => {
    if (transporter)
        return transporter;
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    if (emailUser && emailPass) {
        console.log('Using SMTP configuration from environment variables.');
        transporter = nodemailer_1.default.createTransport({
            host: process.env.EMAIL_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.EMAIL_PORT || '587'),
            secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
            auth: {
                user: emailUser,
                pass: emailPass,
            },
        });
        isEthereal = false;
    }
    else {
        console.log('No EMAIL_USER and EMAIL_PASS config found in env. Setting up Ethereal Mock Mail...');
        try {
            const testAccount = await nodemailer_1.default.createTestAccount();
            transporter = nodemailer_1.default.createTransport({
                host: 'smtp.ethereal.email',
                port: 587,
                secure: false,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass,
                },
            });
            isEthereal = true;
            console.log(`Ethereal mock transporter initialized. Test user: ${testAccount.user}`);
        }
        catch (err) {
            console.error('Failed to create Ethereal mock mail account:', err);
            throw err;
        }
    }
    return transporter;
};
exports.initMail = initMail;
const sendMail = async (to, subject, html) => {
    const activeTransporter = await (0, exports.initMail)();
    const fromName = 'SweetNotes Support';
    const fromEmail = process.env.EMAIL_USER || 'no-reply@sweetnotes.app';
    const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to,
        subject,
        html,
    };
    const info = await activeTransporter.sendMail(mailOptions);
    if (isEthereal) {
        console.log('---------------- MOCK EMAIL SENT ----------------');
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(`Preview URL: ${nodemailer_1.default.getTestMessageUrl(info)}`);
        console.log('-------------------------------------------------');
    }
    else {
        console.log(`Email successfully sent to ${to}. MessageId: ${info.messageId}`);
    }
    return info;
};
exports.sendMail = sendMail;
