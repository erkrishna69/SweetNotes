import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import crypto from 'crypto';
import { sendMail } from '../config/mail';

const JWT_SECRET = process.env.JWT_SECRET || 'sweetnotes_jwt_secret_key';
const JWT_EXPIRES_IN = '30d'; // Set a generous expiration for mobile/desktop app stability

export const register = async (req: Request, res: Response) => {
  try {
    const { email, username, password } = req.body;

    if (!email || !username || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const avatar = `https://api.dicebear.com/7.x/bottts/png?seed=${encodeURIComponent(username)}`;

    const user = new User({
      email: email.toLowerCase(),
      username,
      passwordHash,
      avatar,
    });

    await user.save();

    const token = jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    return res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    return res.status(200).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const getProfile = async (req: any, res: Response) => {
  try {
    const userId = req.user?.userId;
    const user = await User.findById(userId).select('-passwordHash');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({
      id: user._id,
      email: user.email,
      username: user.username,
      avatar: user.avatar,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email address is required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ message: 'Email address not found' });
    }

    const token = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = token;
    user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour

    await user.save();

    const host = req.get('host');
    const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const resetUrl = `${protocol}://${host}/api/auth/reset-password?token=${token}`;

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; background-color: #0D0E14; color: #ECECEC;">
        <h2 style="color: #8B5CF6; font-size: 22px; margin-bottom: 16px;">SweetNotes Password Reset</h2>
        <p style="font-size: 14px; color: rgba(255,255,255,0.7); line-height: 1.5;">You requested a password reset for your SweetNotes account.</p>
        <p style="font-size: 14px; color: rgba(255,255,255,0.7); line-height: 1.5;">Please click the button below to choose a new password. This link is valid for the next 1 hour.</p>
        <div style="margin: 30px 0; text-align: center;">
          <a href="${resetUrl}" style="background: linear-gradient(135deg, #8250FF 0%, #00C8A0 100%); color: white; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Reset Password</a>
        </div>
        <p style="font-size: 12px; color: rgba(255,255,255,0.4); line-height: 1.5;">If you did not request this reset, you can safely ignore this email.</p>
        <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.08); margin: 24px 0;" />
        <p style="font-size: 12px; color: rgba(255,255,255,0.4);">Best regards,<br>The SweetNotes Team</p>
      </div>
    `;

    await sendMail(user.email, 'Reset your SweetNotes password', html);

    return res.status(200).json({ message: 'Password reset link sent to your email.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const renderResetPassword = async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).send(_getErrorHtml('Token is missing or invalid.'));
    }

    const user = await User.findOne({
      resetPasswordToken: token as string,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).send(_getErrorHtml('Password reset token is invalid or has expired.'));
    }

    return res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Password - SweetNotes</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
  ${_getSharedStyles()}
</head>
<body>
  <div class="glow-1"></div>
  <div class="glow-2"></div>
  <div class="container">
    <div class="card">
      <div class="brand-logo">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z" fill="#8B5CF6"/>
        </svg>
        <span class="brand-text">SweetNotes</span>
      </div>
      <h2>Reset Password</h2>
      <p>Enter your new password below to update your account access.</p>
      
      <div id="errorMsg" class="error-msg"></div>

      <form id="resetForm" action="/api/auth/reset-password" method="POST" onsubmit="return validateForm(event)">
        <input type="hidden" name="token" value="${token}">
        
        <div class="input-group">
          <label for="password">NEW PASSWORD</label>
          <input type="password" id="password" name="password" placeholder="Enter at least 6 characters" required>
        </div>

        <div class="input-group">
          <label for="confirmPassword">CONFIRM PASSWORD</label>
          <input type="password" id="confirmPassword" placeholder="Confirm your new password" required>
        </div>

        <button type="submit" id="submitBtn">Update Password</button>
      </form>
    </div>
  </div>

  <script>
    function validateForm(e) {
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      const errorMsg = document.getElementById('errorMsg');

      if (password.length < 6) {
        e.preventDefault();
        errorMsg.textContent = 'Password must be at least 6 characters long.';
        errorMsg.style.display = 'block';
        return false;
      }

      if (password !== confirmPassword) {
        e.preventDefault();
        errorMsg.textContent = 'Passwords do not match.';
        errorMsg.style.display = 'block';
        return false;
      }

      const btn = document.getElementById('submitBtn');
      btn.textContent = 'Updating...';
      btn.disabled = true;
      return true;
    }
  </script>
</body>
</html>
    `);
  } catch (error) {
    console.error('Render reset password error:', error);
    return res.status(500).send(_getErrorHtml('Internal server error'));
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).send(_getErrorHtml('Token and password are required.'));
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).send(_getErrorHtml('Password reset token is invalid or has expired.'));
    }

    if (password.length < 6) {
      return res.status(400).send(_getErrorHtml('Password must be at least 6 characters long.'));
    }

    user.passwordHash = await bcrypt.hash(password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    return res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Success - SweetNotes</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
  ${_getSharedStyles()}
</head>
<body>
  <div class="glow-1"></div>
  <div class="glow-2"></div>
  <div class="container">
    <div class="card">
      <div class="success-icon">✓</div>
      <h2>Password Reset Success</h2>
      <p>Your password has been successfully updated. You can now close this tab and sign in to SweetNotes with your new password!</p>
    </div>
  </div>
</body>
</html>
    `);
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).send(_getErrorHtml('Internal server error.'));
  }
};

const _getSharedStyles = () => `
<style>
  :root {
    --bg-color: #0A0B0F;
    --card-bg: rgba(30, 30, 34, 0.6);
    --border-color: rgba(255, 255, 255, 0.08);
    --primary-color: #8B5CF6;
    --text-color: #ECECEC;
    --text-muted: rgba(255, 255, 255, 0.6);
    --accent-teal: #00C8A0;
    --error-color: #FF5F57;
  }
  
  body {
    background-color: var(--bg-color);
    font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: var(--text-color);
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    margin: 0;
    overflow: hidden;
    position: relative;
  }

  .glow-1 {
    position: absolute;
    width: 400px;
    height: 400px;
    top: -100px;
    left: -100px;
    background: radial-gradient(circle, rgba(130, 80, 255, 0.12) 0%, transparent 70%);
    z-index: -1;
  }

  .glow-2 {
    position: absolute;
    width: 350px;
    height: 350px;
    bottom: -100px;
    right: -100px;
    background: radial-gradient(circle, rgba(0, 200, 160, 0.08) 0%, transparent 70%);
    z-index: -1;
  }

  .container {
    width: 100%;
    max-width: 420px;
    padding: 20px;
    box-sizing: border-box;
    z-index: 10;
  }

  .card {
    background: var(--card-bg);
    backdrop-filter: blur(16px);
    border: 1px solid var(--border-color);
    border-radius: 24px;
    padding: 40px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    text-align: center;
  }

  h2 {
    margin: 0 0 10px 0;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.5px;
  }

  p {
    font-size: 14px;
    color: var(--text-muted);
    margin: 0 0 24px 0;
    line-height: 1.5;
  }

  .input-group {
    margin-bottom: 20px;
    text-align: left;
  }

  label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    margin-bottom: 8px;
    color: var(--text-muted);
    letter-spacing: 0.5px;
  }

  input {
    width: 100%;
    padding: 14px 16px;
    box-sizing: border-box;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    color: white;
    font-size: 14px;
    outline: none;
    transition: all 0.2s ease;
  }

  input:focus {
    border-color: var(--primary-color);
    background: rgba(255, 255, 255, 0.06);
    box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2);
  }

  button {
    width: 100%;
    padding: 16px;
    background: linear-gradient(135deg, #8250FF 0%, #00C8A0 100%);
    border: none;
    border-radius: 12px;
    color: white;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.1s ease, opacity 0.2s ease;
    margin-top: 10px;
  }

  button:hover {
    opacity: 0.95;
  }

  button:active {
    transform: scale(0.98);
  }

  .error-msg {
    color: var(--error-color);
    font-size: 13px;
    margin-bottom: 20px;
    display: none;
    background: rgba(255, 95, 87, 0.1);
    padding: 12px;
    border-radius: 10px;
    border: 1px solid rgba(255, 95, 87, 0.15);
  }

  .success-icon {
    font-size: 48px;
    color: var(--accent-teal);
    margin-bottom: 20px;
  }

  .error-icon {
    font-size: 48px;
    color: var(--error-color);
    margin-bottom: 20px;
  }

  .brand-logo {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-bottom: 24px;
  }

  .brand-logo svg {
    margin-right: 8px;
  }

  .brand-text {
    font-size: 18px;
    font-weight: bold;
    color: white;
    letter-spacing: -0.5px;
  }
</style>
`;

const _getErrorHtml = (errorMessage: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error - SweetNotes</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
  ${_getSharedStyles()}
</head>
<body>
  <div class="glow-1"></div>
  <div class="glow-2"></div>
  <div class="container">
    <div class="card">
      <div class="error-icon">✕</div>
      <h2>Reset Failed</h2>
      <p>${errorMessage}</p>
    </div>
  </div>
</body>
</html>
`;

