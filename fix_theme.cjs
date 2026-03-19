const fs = require('fs');
const path = require('path');

const dir = 'd:/ACEDEMIC/External Projects/Crystal-Sand/src/pages';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx'));

const replacements = [
  {
    regex: /className=(?:\{`|")([^`"]*\btext-white\b[^`"]*)(?:`\}|")/g,
    replace: (match, p1) => {
        if (/bg-/.test(p1) || /btn-primary/.test(p1) || /text-slate-900/.test(p1) || /text-gray-900/.test(p1)) return match;
        return match.replace(/\btext-white\b/, 'text-slate-900 dark:text-white');
    }
  },
  {
    regex: /className=(?:\{`|")([^`"]*\btext-gray-400\b[^`"]*)(?:`\}|")/g,
    replace: (match, p1) => {
        if (/text-slate-500/.test(p1)) return match;
        return match.replace(/\btext-gray-400\b/, 'text-slate-500 dark:text-gray-400');
    }
  },
  {
    regex: /className=(?:\{`|")([^`"]*\bborder-slate-800\b[^`"]*)(?:`\}|")/g,
    replace: (match, p1) => {
        if (/dark:border-slate-800/.test(p1) || /border-slate-200/.test(p1)) return match;
        return match.replace(/\bborder-slate-800\b/, 'border-slate-200 dark:border-slate-800');
    }
  },
  {
    regex: /className=(?:\{`|")([^`"]*\bborder-slate-700\b[^`"]*)(?:`\}|")/g,
    replace: (match, p1) => {
        if (/dark:border-slate-700/.test(p1) || /border-slate-200/.test(p1) || /border-slate-300/.test(p1)) return match;
        return match.replace(/\bborder-slate-700\b/, 'border-slate-200 dark:border-slate-700');
    }
  },
  {
    regex: /className=(?:\{`|")([^`"]*\bbg-slate-900\b[^`"]*)(?:`\}|")/g,
    replace: (match, p1) => {
        if (/dark:bg-slate-900/.test(p1) || /bg-white/.test(p1)) return match;
        return match.replace(/\bbg-slate-900\b/, 'bg-white dark:bg-slate-900');
    }
  },
  {
    regex: /className=(?:\{`|")([^`"]*\bhover:bg-slate-800\/50\b[^`"]*)(?:`\}|")/g,
    replace: (match, p1) => {
        if (/dark:hover:bg-slate-800\/50/.test(p1) || /hover:bg-slate-50/.test(p1) || /hover:bg-slate-100/.test(p1)) return match;
        return match.replace(/\bhover:bg-slate-800\/50\b/, 'hover:bg-slate-100 dark:hover:bg-slate-800/50');
    }
  },
  {
    regex: /className=(?:\{`|")([^`"]*\bbg-slate-800\/50\b[^`"]*)(?:`\}|")/g,
    replace: (match, p1) => {
        if (/dark:bg-slate-800\/50/.test(p1) || /bg-slate-50/.test(p1) || /bg-slate-100/.test(p1)) return match;
        return match.replace(/\bbg-slate-800\/50\b/, 'bg-slate-50 dark:bg-slate-800/50');
    }
  },
  {
    regex: /className=(?:\{`|")([^`"]*\bbg-slate-800\b[^`"]*)(?:`\}|")/g,
    replace: (match, p1) => {
        if (/dark:bg-slate-800/.test(p1) || /bg-slate-100/.test(p1)) return match;
        return match.replace(/\bbg-slate-800\b/, 'bg-slate-100 dark:bg-slate-800');
    }
  },
  {
    regex: /className=(?:\{`|")([^`"]*\btext-slate-400\b[^`"]*)(?:`\}|")/g,
    replace: (match, p1) => {
        if (/dark:text-slate-400/.test(p1)) return match;
        return match.replace(/\btext-slate-400\b/, 'text-slate-600 dark:text-slate-400');
    }
  },
  {
    regex: /className=(?:\{`|")([^`"]*\bhover:bg-slate-700\b[^`"]*)(?:`\}|")/g,
    replace: (match, p1) => {
        if (/dark:hover:bg-slate-700/.test(p1)) return match;
        return match.replace(/\bhover:bg-slate-700\b/, 'hover:bg-slate-200 dark:hover:bg-slate-700');
    }
  },
  {
    regex: /className=(?:\{`|")([^`"]*\btext-slate-300\b[^`"]*)(?:`\}|")/g,
    replace: (match, p1) => {
        if (/dark:text-slate-300/.test(p1)) return match;
        return match.replace(/\btext-slate-300\b/, 'text-slate-700 dark:text-slate-300');
    }
  }
];

files.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  
  replacements.forEach(rep => {
    content = content.replace(rep.regex, rep.replace);
  });
  
  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file}`);
  }
});
