'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../src/index.template.html'),'utf8');
test('phone informational footer and equivalent local label',()=>{assert.ok(html.includes('@media (max-width: 640px) { body > .app-footer { display: none; } }'));assert.ok(html.includes('data-en="Fully local processing"'));});
