const fs = require('fs');
const content = fs.readFileSync('/Volumes/DATA_SSD/Projects/Dunvex_Build-main/src/views/NexusControl.tsx', 'utf8');

let stack = [];
for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '{' || char === '(' || char === '<') stack.push({char, line: content.slice(0, i).split('\n').length});
    else if (char === '}') {
        if (stack.length && stack[stack.length - 1].char === '{') stack.pop();
        else console.log('Unexpected } at line ' + content.slice(0, i).split('\n').length);
    } else if (char === ')') {
        if (stack.length && stack[stack.length - 1].char === '(') stack.pop();
    } else if (char === '>') {
        if (stack.length && stack[stack.length - 1].char === '<') stack.pop();
    }
}
console.log('Unclosed tags:');
console.log(stack.filter(s => s.char === '{'));
