/**
 * Walkthrough · engine/install.js
 * Universal multi-agent installer for Antigravity, Claude Code, Cursor, Windsurf, Copilot & Cline.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const homedir = os.homedir();
const rootDir = path.resolve(__dirname, '..');

const SKILL_MD_SOURCE = path.join(rootDir, 'skills/walkthrough/SKILL.md');
const STORYBOARD_MD_SOURCE = path.join(rootDir, 'skills/walkthrough/references/storyboard.md');

const GLOBAL_TARGETS = [
  {
    name: 'Google Antigravity',
    dir: path.join(homedir, '.gemini', 'config', 'skills', 'walkthrough'),
    checkParent: path.join(homedir, '.gemini'),
  },
  {
    name: 'Claude Code',
    dir: path.join(homedir, '.claude', 'skills', 'walkthrough'),
    checkParent: path.join(homedir, '.claude'),
  },
  {
    name: 'Cursor',
    dir: path.join(homedir, '.cursor', 'skills', 'walkthrough'),
    checkParent: path.join(homedir, '.cursor'),
  },
];

function copySkillFiles(targetDir) {
  fs.mkdirSync(path.join(targetDir, 'references'), { recursive: true });
  fs.copyFileSync(SKILL_MD_SOURCE, path.join(targetDir, 'SKILL.md'));
  if (fs.existsSync(STORYBOARD_MD_SOURCE)) {
    fs.copyFileSync(STORYBOARD_MD_SOURCE, path.join(targetDir, 'references', 'storyboard.md'));
  }
}

function checkDependencies() {
  console.log('\n\x1b[1mChecking System Dependencies:\x1b[0m');
  const results = {};

  // Node
  try {
    const nodeVer = execSync('node --version', { encoding: 'utf8' }).trim();
    console.log(`  \x1b[32m✓\x1b[0m Node.js: ${nodeVer}`);
    results.node = true;
  } catch (_) {
    console.log('  \x1b[31m✗\x1b[0m Node.js not found');
    results.node = false;
  }

  // Python
  const py = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
  try {
    const pyVer = execSync(`${py} --version`, { encoding: 'utf8' }).trim();
    console.log(`  \x1b[32m✓\x1b[0m Python: ${pyVer}`);
    results.python = true;
  } catch (_) {
    console.log(`  \x1b[31m✗\x1b[0m Python (${py}) not found`);
    results.python = false;
  }

  // Python modules
  try {
    execSync(`${py} -c "import edge_tts, numpy, scipy, PIL"`, { stdio: 'ignore' });
    console.log('  \x1b[32m✓\x1b[0m Python Libraries: edge-tts, numpy, scipy, Pillow (OK)');
    results.pythonLibs = true;
  } catch (_) {
    console.log('  \x1b[33m⚠\x1b[0m Python Libraries: missing one or more of [edge-tts, numpy, scipy, Pillow]');
    console.log('    Run: pip install -r requirements.txt');
    results.pythonLibs = false;
  }

  // FFmpeg
  try {
    const ffmpegVer = execSync('ffmpeg -version', { encoding: 'utf8' }).split('\n')[0];
    console.log(`  \x1b[32m✓\x1b[0m FFmpeg: ${ffmpegVer}`);
    results.ffmpeg = true;
  } catch (_) {
    console.log('  \x1b[31m✗\x1b[0m FFmpeg not found on PATH');
    results.ffmpeg = false;
  }

  // Playwright
  try {
    const pw = require('playwright');
    console.log('  \x1b[32m✓\x1b[0m Playwright: installed');
    results.playwright = true;
  } catch (_) {
    console.log('  \x1b[33m⚠\x1b[0m Playwright module: run npm install');
    results.playwright = false;
  }

  return results;
}

function installGlobal() {
  console.log('\n\x1b[1m\x1b[32m[Walkthrough]\x1b[0m Installing Walkthrough Skill Globally Across AI Coding Agents...\n');

  let installedCount = 0;
  for (const target of GLOBAL_TARGETS) {
    try {
      copySkillFiles(target.dir);
      console.log(`  \x1b[32m✓\x1b[0m ${target.name}: installed -> ${target.dir}`);
      installedCount++;
    } catch (err) {
      console.warn(`  \x1b[31m✗\x1b[0m ${target.name}: ${err.message}`);
    }
  }

  // Link CLI globally
  console.log('\n\x1b[1mRegistering Global CLI Command:\x1b[0m');
  try {
    execSync('npm link', { cwd: rootDir, stdio: 'ignore' });
    console.log('  \x1b[32m✓\x1b[0m `walkthrough` CLI linked globally (run `walkthrough help` anywhere)');
  } catch (err) {
    console.log(`  \x1b[33m⚠\x1b[0m npm link notice: ${err.message}`);
  }

  checkDependencies();

  console.log(`\n\x1b[1m\x1b[32mInstallation Complete!\x1b[0m Walkthrough is now active for ${installedCount} agent platforms.`);
  console.log('Triggers:');
  console.log('  - Antigravity: /walkthrough or @walkthrough');
  console.log('  - Claude Code: /walkthrough or "make a walkthrough video"');
  console.log('  - Cursor: "create a walkthrough demo" (via global skill)');
  console.log('  - CLI: `walkthrough demo`, `walkthrough run`, `walkthrough plan`\n');
}

function installProject(targetDir = process.cwd()) {
  console.log(`\n\x1b[1m\x1b[32m[Walkthrough]\x1b[0m Configuring Walkthrough for Project: ${targetDir}\n`);

  // 1. Antigravity workspace skill
  const agySkillDir = path.join(targetDir, '.agents', 'skills', 'walkthrough');
  copySkillFiles(agySkillDir);
  console.log(`  \x1b[32m✓\x1b[0m Antigravity project skill: ${agySkillDir}`);

  // 2. Cursor rules
  const cursorRulesDir = path.join(targetDir, '.cursor', 'rules');
  fs.mkdirSync(cursorRulesDir, { recursive: true });
  const cursorRuleContent = `---
description: Autonomous product demo video generator — physics cursor, cinematic camera, neural voiceover, and acoustic SFX
globs: *
alwaysApply: false
---

# Walkthrough for Cursor Agent

Use the Walkthrough engine to autonomously generate high-production product demo videos.

## Workflow
1. Inspect the web application in this repo (package.json, start command, target URL e.g. http://localhost:5173 or 3000).
2. Choose the right mode:
   - "walkthrough": Complete real UI feature demo / tutorial.
   - "explainer": Concept + UI proof with designed interstitials.
   - "pitch": High-impact 15-30s claim -> proof -> CTA teaser.
3. Write \`storyboard.json\` (version 3):
   - title, mode, baseUrl, outputDir ("./walkthrough-output").
   - steps with selector, action ("click" | "type" | "press" | "hover" | "select"), holdMs, waitFor outcome.
4. Execute:
   - \`walkthrough plan storyboard.json\` (validate)
   - \`walkthrough run storyboard.json\` (record)
   - \`walkthrough verify walkthrough-output/raw_walkthrough.mp4 --approve-visual\` (review)
`;
  fs.writeFileSync(path.join(cursorRulesDir, 'walkthrough.mdc'), cursorRuleContent, 'utf8');
  console.log(`  \x1b[32m✓\x1b[0m Cursor rules: ${path.join(cursorRulesDir, 'walkthrough.mdc')}`);

  // 3. Claude Code project configuration
  const claudeMdPath = path.join(targetDir, 'CLAUDE.md');
  const claudeSnippet = `
## Walkthrough Video Generation
When asked to create a product demo, walkthrough video, pitch, or explainer:
1. Inspect package.json / start command and target URL.
2. Select mode: \`walkthrough\` (tutorial), \`explainer\` (concept + proof), or \`pitch\` (15-30s launch teaser).
3. Author \`storyboard.json\` with semantic selectors, actions, hold durations, and \`waitFor\` conditions.
4. Commands:
   - \`walkthrough plan storyboard.json\` -> Validate schema
   - \`walkthrough run storyboard.json\` -> Record browser session with physics cursor and camera
   - \`walkthrough verify <video.mp4> --approve-visual\` -> Oracle quality audit
`;
  if (fs.existsSync(claudeMdPath)) {
    const existing = fs.readFileSync(claudeMdPath, 'utf8');
    if (!existing.includes('Walkthrough Video Generation')) {
      fs.appendFileSync(claudeMdPath, `\n${claudeSnippet}`, 'utf8');
      console.log(`  \x1b[32m✓\x1b[0m Appended Walkthrough instructions to CLAUDE.md`);
    } else {
      console.log(`  \x1b[32m✓\x1b[0m CLAUDE.md already configured`);
    }
  } else {
    fs.writeFileSync(claudeMdPath, `# Project Guidelines\n${claudeSnippet}`, 'utf8');
    console.log(`  \x1b[32m✓\x1b[0m Created CLAUDE.md with Walkthrough instructions`);
  }

  // 4. Windsurf rules
  const windsurfPath = path.join(targetDir, '.windsurfrules');
  if (!fs.existsSync(windsurfPath)) {
    fs.writeFileSync(windsurfPath, `# Windsurf Rules · Walkthrough\n${claudeSnippet}`, 'utf8');
    console.log(`  \x1b[32m✓\x1b[0m Created .windsurfrules`);
  }

  // 5. GitHub Copilot instructions
  const copilotDir = path.join(targetDir, '.github');
  fs.mkdirSync(copilotDir, { recursive: true });
  const copilotPath = path.join(copilotDir, 'copilot-instructions.md');
  if (!fs.existsSync(copilotPath)) {
    fs.writeFileSync(copilotPath, `# GitHub Copilot Instructions\n${claudeSnippet}`, 'utf8');
    console.log(`  \x1b[32m✓\x1b[0m Created .github/copilot-instructions.md`);
  }

  // 6. Cline / Roo Code rules
  const clinePath = path.join(targetDir, '.clinerules');
  if (!fs.existsSync(clinePath)) {
    fs.writeFileSync(clinePath, `# Cline / Roo Code Rules\n${claudeSnippet}`, 'utf8');
    console.log(`  \x1b[32m✓\x1b[0m Created .clinerules`);
  }

  // 7. Universal AGENTS.md
  const agentsPath = path.join(targetDir, 'AGENTS.md');
  if (!fs.existsSync(agentsPath)) {
    fs.writeFileSync(agentsPath, `# AGENTS.md\n${claudeSnippet}`, 'utf8');
    console.log(`  \x1b[32m✓\x1b[0m Created AGENTS.md`);
  }

  checkDependencies();
  console.log('\n\x1b[1m\x1b[32mProject configuration complete!\x1b[0m Any AI agent opened in this repository will now recognize Walkthrough.');
}

if (require.main === module) {
  const isGlobal = process.argv.includes('--global') || process.argv.includes('-g');
  const isCheck = process.argv.includes('--check');

  if (isCheck) {
    checkDependencies();
  } else if (isGlobal) {
    installGlobal();
  } else {
    // Default to both global agent setup + local project setup
    installGlobal();
    installProject(rootDir);
  }
}

module.exports = { installGlobal, installProject, checkDependencies };
