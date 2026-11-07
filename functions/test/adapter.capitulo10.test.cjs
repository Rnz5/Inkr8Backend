const {test} = require('node:test');
const assert = require('node:assert/strict');
// Interceptar el módulo antes de cargar el adaptador: no crea sockets ni usa claves reales.
const key = require.resolve('openai'), original=require(key);
const requests=[], options=[];
let response, failure;
class FakeOpenAI {
  static APIConnectionTimeoutError=original.APIConnectionTimeoutError;
  constructor(config){options.push(config);this.chat={completions:{create:async request=>{requests.push(request);if(failure)throw failure;return response;}}};}
}
require.cache[key].exports=FakeOpenAI;
const {OpenAiWritingEvaluator}=require('../lib/data/source/openAiWritingEvaluator');
require.cache[key].exports=original;
const {EvaluationTimeout}=require('../lib/domain/model/models');
const validSubmission='I use ink and tree. Why? '+Array(44).fill('word').join(' ');
const otherSubmission='I see ink and tree. Why? '+Array(44).fill('word').join(' ');
const base={id:'g',authorId:'alice',mode:'RANKED',status:'PENDING',seasonIndex:0,timestamp:0,writingMode:'ON_TOPIC',content:validSubmission,challenge:{words:[{text:'ink',definition:'Fluid',sentence:'Use ink.'},{text:'tree',definition:'Plant',sentence:'A tree.'}],topic:'Nature',theme:'Life',advanced:['FIRST_PERSON','QUESTION']}};
const details={score:74,feedback:'Base',spelling:'S',vocabulary:'V',coherence:'C',creativity:'R',topicRelevant:true};
function reset(result=details){requests.length=0;options.length=0;failure=null;response={choices:[{message:{content:JSON.stringify(result)}}]};}
const sut=new OpenAiWritingEvaluator(()=> 'test-key-not-valid');
test('CN-JEA-01-C01 adaptador recibe seis campos efectivos y configura timeout 90000 sin retries SDK',async()=>{
  reset();assert.deepEqual(await sut.evaluate(base),details);
  assert.deepEqual(options,[{apiKey:'test-key-not-valid',timeout:90000,maxRetries:0}]);
  const payload=JSON.parse(requests[0].messages[1].content);
  assert.equal(validSubmission.split(/\s+/).length,50);
  assert.deepEqual(payload,{writingMode:'ON_TOPIC',minWords:50,maxWords:200,requiredWords:['ink','tree'],topic:'Nature',theme:'Life',advanced:['FIRST_PERSON','QUESTION'],submission:validSubmission});
  assert.equal(requests[0].model,'gpt-4o-mini');assert.equal(requests[0].response_format.type,'json_object');
});
const changes=[['writingMode','STANDARD','writingMode','STANDARD'],['content',otherSubmission,'submission',otherSubmission],
  ['words',[{text:'word',definition:'Term',sentence:'Use word.'},{text:'tree',definition:'Plant',sentence:'A tree.'}],'requiredWords',['word','tree']],['topic',null,'topic',null],['theme','Technology','theme','Technology'],['advanced',[],'advanced',[]]];
changes.forEach(([field,value,output,expected],i)=>test(`CN-JEA-01-C${String(i+2).padStart(2,'0')} campo ${field} influye en request`,async()=>{
  reset();const game=structuredClone(base);
  if(['writingMode','content'].includes(field)) game[field]=value;else game.challenge[field]=value;
  if(field==='writingMode')game.challenge={words:[...game.challenge.words,{text:'word',definition:'Term',sentence:'A word.'},{text:'why',definition:'Question',sentence:'Why?'}],topic:null,theme:null};
  await sut.evaluate(game);const payload=JSON.parse(requests[0].messages[1].content);assert.deepEqual(payload[output],expected);
  if(field==='writingMode'){assert.equal(payload.maxWords,150);assert.equal(payload.requiredWords.length,4);assert.equal(payload.topic,null);assert.deepEqual(payload.advanced,[]);}
}));
test('ADAPT-01 timeout SDK se traduce a EvaluationTimeout sin esperar 90 s',async()=>{
  reset();failure=new original.APIConnectionTimeoutError();await assert.rejects(()=>sut.evaluate(base),EvaluationTimeout);
});
test('ADAPT-02 JSON mal formado rechaza respuesta',async()=>{
  reset();response.choices[0].message.content='{broken';await assert.rejects(()=>sut.evaluate(base),SyntaxError);
});
test('ADAPT-03 cuota no se traduce a timeout',async()=>{
  reset();failure=Object.assign(new Error('quota'),{status:429});await assert.rejects(()=>sut.evaluate(base),failure);
});
test('ADAPT-04 respuesta vacía no crea evaluación válida (score undefined)',async()=>{
  reset();response={choices:[]};assert.deepEqual(await sut.evaluate(base),{score:undefined,feedback:''});
});
test('ADAPT-05 indisponibilidad 503 se propaga sin simular timeout',async()=>{
  reset();failure=Object.assign(new Error('unavailable'),{status:503});await assert.rejects(()=>sut.evaluate(base),failure);
});
