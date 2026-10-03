import {spawn} from 'node:child_process';
import {parseArgs} from 'node:util';
import {fileURLToPath} from 'node:url';
import {SerialGateway} from '../src/serial-gateway.mjs';

const {values}=parseArgs({options:{device:{type:'string'},baud:{type:'string'},flow:{type:'string'},port:{type:'string',default:'8912'},help:{type:'boolean'}}});
if(values.help){console.log('node scripts/locobuffer-gateway.mjs --device /dev/... --baud 57600 --flow rtscts [--port 8912]\nLocal POSIX gateway, 8N1. Explicit hardware settings required. No automatic replay or field-state synthesis.');process.exit(0);}
if(!values.device||!['9600','19200','38400','57600','115200'].includes(values.baud)||!['none','rtscts'].includes(values.flow)||!/^\d+$/.test(values.port)||Number(values.port)>65535)throw Error('Ange enhet, verifierad baud och flödeskontroll. Se --help.');
const serial=spawn(process.env.PYTHON||'python3',[fileURLToPath(new URL('serial-port.py',import.meta.url)),'--device',values.device,'--baud',values.baud,'--flow',values.flow],{stdio:['pipe','pipe','pipe']});
let stopping=false,ready=false,errors='';
const gateway=new SerialGateway({writeBytes:bytes=>{if(!ready||serial.stdin.destroyed||serial.stdin.writableLength>65536)throw Error('Serial unavailable');serial.stdin.write(bytes);},closeSerial:()=>{stopping=true;serial.kill('SIGTERM');}});
serial.stdout.on('data',bytes=>gateway.push(bytes));serial.stdin.on('error',()=>gateway.fail('Serial pipe failed'));
serial.stderr.on('data',chunk=>{errors+=chunk.toString();const rows=errors.split('\n');errors=rows.pop();if(errors.length>4096)gateway.fail('Serial status overflow');for(const line of rows){if(line==='READY'&&!ready){ready=true;gateway.listen(Number(values.port)).then(port=>console.log('LocoBuffer gateway: 127.0.0.1:'+port)).catch(()=>gateway.fail('Local TCP port unavailable'));}else if(line)console.error(line);}});
serial.on('error',e=>{console.error(e.message);process.exitCode=1;gateway.fail('Serial process unavailable');});
serial.on('exit',code=>{if(!stopping){process.exitCode=code||1;gateway.fail('Serial process ended');}});
for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>gateway.close());
