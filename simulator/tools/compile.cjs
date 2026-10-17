// Deliberately small, fail-closed compiler for prototype/engine.js.
// JS array indices and truthiness are preserved by runtime.lua; unsupported syntax aborts.
const ts=require('typescript');
const q=s=>JSON.stringify(s).replace(/\\u([0-9a-f]{4})/gi,(_,v)=>String.fromCharCode(parseInt(v,16)));
function compile(source){
 const ast=ts.createSourceFile('engine.js',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 let serial=0, loops=[];
 const fresh=()=>`__tmp${++serial}`, name=s=>'v_'+s;
 function fail(n){throw Error(`Unsupported ${ts.SyntaxKind[n.kind]}: ${n.getText(ast).slice(0,200)}`)}
 function key(n){if(ts.isIdentifier(n)||ts.isStringLiteral(n)||ts.isNumericLiteral(n))return q(n.text);if(ts.isComputedPropertyName(n))return e(n.expression);return fail(n)}
 function assign(lhs,value){
  if(ts.isIdentifier(lhs))return `${name(lhs.text)} = ${value}`;
  if(ts.isPropertyAccessExpression(lhs))return `Jset(${e(lhs.expression)},${q(lhs.name.text)},${value})`;
  if(ts.isElementAccessExpression(lhs))return `Jset(${e(lhs.expression)},${e(lhs.argumentExpression)},${value})`;
  if(ts.isArrayLiteralExpression(lhs)){let v=fresh();return `local ${v} = ${value}\n`+lhs.elements.map((n,i)=>assign(n,`Jget(${v},${i})`)).join('\n')}
  return fail(lhs);
 }
 function bind(n,value,local=true){
  if(ts.isIdentifier(n))return `${local?'local '+name(n.text)+'\n':''}${name(n.text)} = ${value}`;
  if(ts.isArrayBindingPattern(n)||ts.isObjectBindingPattern(n)){let v=fresh();return `local ${v} = ${value}\n`+n.elements.map((x,i)=>ts.isOmittedExpression(x)?'':bind(x.name,`Jget(${v},${ts.isArrayBindingPattern(n)?i:key(x.propertyName||x.name)})`,local)+(x.initializer?`\nif ${name(x.name.text)} == nil then ${name(x.name.text)} = ${e(x.initializer)} end`:'' )).join('\n')}
  return fail(n);
 }
 function fn(n,method=false){
  const params=n.parameters.map(p=>ts.isIdentifier(p.name)?name(p.name.text):fresh());
  let init=n.parameters.map((p,i)=>(p.initializer?`if ${params[i]} == nil then ${params[i]} = ${e(p.initializer)} end\n`:'')+(!ts.isIdentifier(p.name)?bind(p.name,params[i]):'')).join('\n');
  let saved=loops;loops=[];let body=ts.isBlock(n.body)?block(n.body):`return ${e(n.body)}`;loops=saved;
  return `function(${method||!ts.isArrowFunction(n)?'this':'__unused'}${params.length?','+params.join(','):''})\n${init}\n${body}\nend`;
 }
 function update(n,prefix){let x=n.operand,d=n.operator===ts.SyntaxKind.PlusPlusToken?1:-1,v=fresh();return `(function() local ${v}=${e(x)}; ${assign(x,`${v}+(${d})`)}; return ${prefix?`${v}+(${d})`:v} end)()`}
 function e(n){
  if(!n)return 'nil';
  if(ts.isParenthesizedExpression(n))return '('+e(n.expression)+')';
  if(ts.isIdentifier(n))return n.text==='undefined'?'nil':name(n.text);
  if(n.kind===ts.SyntaxKind.ThisKeyword)return 'this';
  if(n.kind===ts.SyntaxKind.TrueKeyword)return 'true';if(n.kind===ts.SyntaxKind.FalseKeyword)return 'false';if(n.kind===ts.SyntaxKind.NullKeyword)return 'JNULL';
  if(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n))return q(n.text);
  if(n.kind===ts.SyntaxKind.RegularExpressionLiteral)return `Jobj({pattern=${q(n.text.slice(1,n.text.lastIndexOf('/')))}})`;
  if(ts.isNumericLiteral(n))return String(Number(n.text))+(Number.isInteger(Number(n.text))?'.0':'');
  if(ts.isTemplateExpression(n))return '('+[q(n.head.text),...n.templateSpans.flatMap(x=>[`Jstr(${e(x.expression)})`,q(x.literal.text)])].join(' .. ')+')';
  if(ts.isArrayLiteralExpression(n))return n.elements.some(ts.isSpreadElement)?`Jconcat(${n.elements.map(x=>ts.isSpreadElement(x)?e(x.expression):`Jarr(1,${e(x)})`).join(',')})`:`Jarr(${n.elements.length}${n.elements.length?','+n.elements.map(e).join(','):''})`;
  if(ts.isObjectLiteralExpression(n)){let parts=[],fields=[],keys=[];const flush=()=>{if(fields.length){parts.push(`Jobj({${fields.join(',')}},{${keys.join(',')}})`);fields=[];keys=[]}};for(let p of n.properties){if(ts.isSpreadAssignment(p)){flush();parts.push(e(p.expression))}else if(ts.isPropertyAssignment(p)){fields.push(`[${key(p.name)}]=${e(p.initializer)}`);keys.push(key(p.name))}else if(ts.isShorthandPropertyAssignment(p)){fields.push(`[${key(p.name)}]=${e(p.name)}`);keys.push(key(p.name))}else fail(p)}flush();return (parts.length>1||n.properties.some(ts.isSpreadAssignment))?`Jmerge(${parts.join(',')})`:parts[0]||'Jobj({})'}
  if(ts.isPropertyAccessExpression(n))return `${n.questionDotToken?'Jopt':'Jget'}(${e(n.expression)},${q(n.name.text)})`;
  if(ts.isElementAccessExpression(n))return `${n.questionDotToken?'Jopt':'Jget'}(${e(n.expression)},${e(n.argumentExpression)})`;
  if(ts.isCallExpression(n)){
   if(n.getText(ast).startsWith('JSON.parse(JSON.stringify('))return `Jclone(${e(n.arguments[0].arguments[0])})`;
   let a=n.arguments.map(e).join(','),c=n.expression;
   if(ts.isPropertyAccessExpression(c))return `${n.questionDotToken?'JoptionalCall':'Jcall'}(${e(c.expression)},${q(c.name.text)}${a?','+a:''})`;
   if(ts.isElementAccessExpression(c))return `Jcall(${e(c.expression)},${e(c.argumentExpression)}${a?','+a:''})`;
   return `Jinvoke(${e(c)}${a?','+a:''})`;
  }
  if(ts.isNewExpression(n))return `Jnew(${e(n.expression)}${n.arguments?.length?','+n.arguments.map(e).join(','):''})`;
  if(ts.isArrowFunction(n)||ts.isFunctionExpression(n))return fn(n);
  if(ts.isConditionalExpression(n))return `Jcond(${e(n.condition)},function() return ${e(n.whenTrue)} end,function() return ${e(n.whenFalse)} end)`;
  if(ts.isPrefixUnaryExpression(n)){if([ts.SyntaxKind.PlusPlusToken,ts.SyntaxKind.MinusMinusToken].includes(n.operator))return update(n,true);if(n.operator===ts.SyntaxKind.ExclamationToken)return `(not Jtruth(${e(n.operand)}))`;if(n.operator===ts.SyntaxKind.MinusToken)return `(-${e(n.operand)})`;if(n.operator===ts.SyntaxKind.PlusToken)return `Jnum(${e(n.operand)})`;return fail(n)}
  if(ts.isPostfixUnaryExpression(n))return update(n,false);
  if(ts.isDeleteExpression(n))return `(function() ${assign(n.expression,'nil')}; return true end)()`;
  if(ts.isTypeOfExpression(n))return `Jtypeof(${e(n.expression)})`;
  if(ts.isBinaryExpression(n)){
   let op=n.operatorToken.getText(ast),a=e(n.left),b=e(n.right);
   if(['&&','||','??'].includes(op))return `${{'&&':'Jand','||':'Jor','??':'Jnull'}[op]}(${a},function() return ${b} end)`;
   if(['=','+=','-=','*=','/=','%='].includes(op)){let v=fresh();return `(function() local ${v} = ${op==='='?b:op==='+='?`Jadd(${a},${b})`:`(${a} ${op[0]} ${b})`}; ${assign(n.left,v)}; return ${v} end)()`}
   if(op==='+')return `Jadd(${a},${b})`;
   if(op==='**')return `(${a} ^ ${b})`;
   const ops={'===':'==','!==':'~=','==':'==','!=':'~=','-':'-','*':'*','/':'/','%':'%','>':'>','<':'<','>=':'>=','<=':'<='};
   if(ops[op])return `(${a} ${ops[op]} ${b})`;
   return fail(n);
  }
  return fail(n);
 }
 function block(n){return n.statements.map(s).join('\n')}
 function loopBody(n,inc=''){let l=fresh();loops.push(l);let b=s(n.statement);loops.pop();return `do\n${b}\nend\n::${l}::\n${inc}`}
 function s(n){
  if(ts.isBlock(n))return 'do\n'+block(n)+'\nend';
  if(ts.isVariableStatement(n))return n.declarationList.declarations.map(d=>bind(d.name,e(d.initializer))).join('\n');
  if(ts.isExpressionStatement(n))return `do local __discard = ${e(n.expression)} end`;
  if(ts.isReturnStatement(n))return `do return ${e(n.expression)} end`;
  if(ts.isIfStatement(n))return `if Jtruth(${e(n.expression)}) then\n${s(n.thenStatement)}${n.elseStatement?'\nelse\n'+s(n.elseStatement):''}\nend`;
  if(ts.isForOfStatement(n)){let v=fresh();return `for _, ${v} in Jiter(${e(n.expression)}) do\n${bind(n.initializer.declarations[0].name,v)}\n${loopBody(n)}\nend`}
  if(ts.isForStatement(n)){let init=n.initializer?ts.isVariableDeclarationList(n.initializer)?n.initializer.declarations.map(d=>bind(d.name,e(d.initializer))).join('\n'):`do local __discard=${e(n.initializer)} end`:'';return `do\n${init}\nwhile Jtruth(${n.condition?e(n.condition):'true'}) do\n${loopBody(n,n.incrementor?`do local __discard=${e(n.incrementor)} end`:'')}\nend\nend`}
  if(ts.isWhileStatement(n))return `while Jtruth(${e(n.expression)}) do\n${loopBody(n)}\nend`;
  if(ts.isBreakStatement(n))return 'break';
  if(ts.isContinueStatement(n))return `goto ${loops.at(-1)}`;
  if(ts.isThrowStatement(n))return `error(${e(n.expression)})`;
  if(ts.isEmptyStatement(n))return '';
  if(ts.isFunctionDeclaration(n))return `local ${name(n.name.text)}\n${name(n.name.text)} = ${fn(n)}`;
  if(ts.isClassDeclaration(n)){let c=name(n.name.text);return `local ${c} = Jclass()\n`+n.members.map(m=>{if(ts.isConstructorDeclaration(m))return `${c}.__ctor=${fn(m,true)}`;if(ts.isGetAccessorDeclaration(m))return `${c}.__getters[${key(m.name)}]=${fn(m,true)}`;if(ts.isMethodDeclaration(m))return `${c}.__proto[${key(m.name)}]=${fn(m,true)}`;return fail(m)}).join('\n')}
  return fail(n);
 }
 return block(ast);
}
module.exports={compile};
