import { Router, Request, Response } from 'express';
import { Note } from '../models/Note';

const router = Router();

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note || note.isDeleted) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Note Not Found - SweetNotes</title>
          <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600&display=swap" rel="stylesheet">
          <style>
            body {
              background-color: #0A0B0F;
              color: #white;
              font-family: 'Outfit', sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
            }
            .card {
              background: rgba(255, 255, 255, 0.03);
              backdrop-filter: blur(10px);
              border: 1px solid rgba(255, 255, 255, 0.08);
              border-radius: 16px;
              padding: 40px;
              text-align: center;
              max-width: 400px;
            }
            h1 {
              color: #8250FF;
              margin-top: 0;
            }
            p {
              color: rgba(255, 255, 255, 0.6);
            }
            a {
              display: inline-block;
              margin-top: 20px;
              padding: 10px 20px;
              background: linear-gradient(135deg, #8250FF, #00C8A0);
              color: white;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 600;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>404</h1>
            <p>This note doesn't exist, is private, or has been deleted.</p>
            <a href="/">Go to Home</a>
          </div>
        </body>
        </html>
      `);
    }

    // Intercept with WebPulse tracking redirection if not already redirected
    if (req.query.from_webpulse !== "true") {
      const monitorId = "6a413443326d8179b44e967d";
      const monitorToken = "4001b8c505733063c2e8155e029f423fb6fb56178089bb86e54a4db7eb5fd6aa";
      const cleanCode = note._id.toString().toLowerCase();

      // Fire and forget (register in background asynchronously to prevent blocking redirection)
      fetch("https://webpulse-tgcz.onrender.com/api/deeplinks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-monitor-token": monitorToken
        },
        body: JSON.stringify({
          monitorId,
          name: `Note Share - ${note.title || 'Untitled'}`,
          path: `share/${cleanCode}`,
          fallbackUrl: `https://sweetnotes-k7si.onrender.com/share/${cleanCode}?from_webpulse=true`,
          code: cleanCode
        })
      }).catch((err) => {
        console.error("Error creating deep link on WebPulse:", err);
      });

      return res.redirect(`https://webpulse-tgcz.onrender.com/dl/${cleanCode}`);
    }

    // Convert some basic markdown to HTML for beautiful viewing
    let formattedContent = note.content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/#\s+(.*?)(\n|$)/g, '<h1>$1</h1>')
      .replace(/##\s+(.*?)(\n|$)/g, '<h2>$1</h2>')
      .replace(/###\s+(.*?)(\n|$)/g, '<h3>$1</h3>')
      .replace(/#(\w+)/g, '<span class="hashtag">#$1</span>');

    const formattedDate = new Date(note.clientUpdatedAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    return res.status(200).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${note.title || 'Untitled Note'} - SweetNotes Share</title>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600&family=DM+Serif+Display&display=swap" rel="stylesheet">
        <style>
          :root {
            --bg-color: #0A0B0F;
            --card-bg: rgba(255, 255, 255, 0.02);
            --border-color: rgba(255, 255, 255, 0.08);
            --primary: #8250FF;
            --accent: #00C8A0;
            --text-main: rgba(255, 255, 255, 0.9);
            --text-muted: rgba(255, 255, 255, 0.4);
          }

          body {
            background-color: var(--bg-color);
            color: var(--text-main);
            font-family: 'Outfit', sans-serif;
            margin: 0;
            padding: 24px;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            min-height: 100vh;
            box-sizing: border-box;
          }

          /* Background glow circles */
          .glow-1 {
            position: fixed;
            top: -10%;
            left: -10%;
            width: 40vw;
            height: 40vw;
            background: radial-gradient(circle, rgba(130, 80, 255, 0.1) 0%, transparent 70%);
            pointer-events: none;
            z-index: -1;
          }
          .glow-2 {
            position: fixed;
            bottom: -10%;
            right: -10%;
            width: 35vw;
            height: 35vw;
            background: radial-gradient(circle, rgba(0, 200, 160, 0.08) 0%, transparent 70%);
            pointer-events: none;
            z-index: -1;
          }

          .container {
            width: 100%;
            max-width: 700px;
            background: var(--card-bg);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid var(--border-color);
            border-radius: 20px;
            padding: 40px;
            box-sizing: border-box;
            box-shadow: 0 20px 40px rgba(0,0,0,0.5);
          }

          header {
            display: flex;
            align-items: center;
            margin-bottom: 30px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
            padding-bottom: 16px;
          }

          .logo-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: linear-gradient(135deg, var(--primary), var(--accent));
            margin-right: 8px;
          }

          .logo-text {
            font-weight: 600;
            font-size: 14px;
            letter-spacing: 0.5px;
            background: linear-gradient(135deg, var(--primary), var(--accent));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }

          h1.note-title {
            font-family: 'DM Serif Display', serif;
            font-size: 32px;
            margin: 0 0 10px 0;
            color: rgba(255, 255, 255, 0.95);
            font-weight: normal;
          }

          .meta {
            font-size: 12px;
            color: var(--text-muted);
            margin-bottom: 24px;
          }

          .note-body {
            font-size: 16px;
            line-height: 1.8;
            color: rgba(255, 255, 255, 0.8);
            white-space: pre-wrap;
          }

          .note-body h1, .note-body h2, .note-body h3 {
            font-family: 'DM Serif Display', serif;
            margin-top: 24px;
            margin-bottom: 12px;
            font-weight: normal;
          }

          .note-body h1 { font-size: 26px; }
          .note-body h2 { font-size: 22px; }
          .note-body h3 { font-size: 18px; }

          .note-body code {
            font-family: monospace;
            background: rgba(0, 200, 160, 0.15);
            color: #00C8A0;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 14px;
          }

          .hashtag {
            color: var(--primary);
            font-weight: 500;
          }

          footer {
            margin-top: 50px;
            text-align: center;
            border-top: 1px solid rgba(255, 255, 255, 0.06);
            padding-top: 24px;
          }

          .cta-btn {
            display: inline-block;
            background: linear-gradient(135deg, var(--primary), var(--accent));
            color: white;
            text-decoration: none;
            padding: 10px 24px;
            border-radius: 30px;
            font-weight: 500;
            font-size: 14px;
            transition: transform 0.2s ease;
          }

          .cta-btn:hover {
            transform: scale(1.03);
          }
        </style>
      </head>
      <body>
        <div class="glow-1"></div>
        <div class="glow-2"></div>
        <div class="container">
          <header>
            <div class="logo-dot"></div>
            <div class="logo-text">SweetNotes</div>
          </header>
          <main>
            <h1 class="note-title">${note.title || 'Untitled Note'}</h1>
            <div class="meta">Last edited on ${formattedDate}</div>
            <div class="note-body">${formattedContent}</div>
          </main>
          <footer>
            <a href="#" class="cta-btn">Create with SweetNotes</a>
          </footer>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Render shared note error:', error);
    return res.status(500).send('Internal Server Error');
  }
});

router.get('/join/:inviteCode', async (req: Request, res: Response) => {
  try {
    const { inviteCode } = req.params;
    const Team = require('../models/Team').Team;
    const team = await Team.findOne({ inviteCode: inviteCode.toUpperCase() });
    if (!team) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Invite Link Expired - SweetNotes</title>
          <style>
            body { background: #0A0B0F; color: white; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 40px; border-radius: 12px; text-align: center; max-width: 400px; }
            h1 { color: #FF5F57; }
            p { color: #aaa; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Link Expired</h1>
            <p>This invite link has already been used or has expired. Please ask the team owner to generate a new invite link.</p>
          </div>
        </body>
        </html>
      `);
    }

    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>You are Invited! - SweetNotes</title>
        <style>
          body { background: #0A0B0F; color: white; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); padding: 40px; border-radius: 12px; text-align: center; max-width: 500px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
          h1 { color: #8250FF; font-size: 24px; margin-bottom: 8px; }
          p { color: #aaa; font-size: 14px; line-height: 1.5; }
          .code-box { background: rgba(0, 200, 160, 0.15); border: 1px dashed #00C8A0; padding: 12px; border-radius: 8px; font-size: 22px; font-weight: bold; color: #00C8A0; letter-spacing: 2px; margin: 20px 0; }
          .note { font-size: 11px; color: #666; margin-top: 15px; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>You are Invited!</h1>
          <p>You have been invited to join the collaboration team: <br><strong style="color: white; font-size: 18px;">${team.name}</strong></p>
          
          <a href="sweetnotes://join/${inviteCode.toUpperCase()}" style="display: inline-block; margin: 15px 0; padding: 12px 24px; background: linear-gradient(135deg, #8250FF, #00C8A0); color: white; text-decoration: none; border-radius: 30px; font-weight: 500; font-size: 14px;">Join Team directly</a>
          
          <p>Or manually enter the code below inside the SweetNotes app:</p>
          <div class="code-box">${inviteCode.toUpperCase()}</div>
          <p class="note">Security Notice: This link is one-time use only. It will automatically expire and rotate once a member joins the team.</p>
        </div>
        <script>
          // Automatically try to open in app when page loads
          setTimeout(function() {
            window.location.href = "sweetnotes://join/${inviteCode.toUpperCase()}";
          }, 300);
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Join invite render error:', error);
    return res.status(500).send('Internal Server Error');
  }
});

export default router;
