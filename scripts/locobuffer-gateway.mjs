import {spawn} from 'node:child_process';
import {parseArgs} from 'node:util';
import {fileURLToPath} from 'node:url';
import {SerialGateway} from '../src/serial-gateway.mjs';

// Två anslutningar till LocoNet: en LocoBuffer på USB (serieport) och Möllehems BTLocoBridge över Bluetooth.
// Bluetooth-kortet nås med sin adress över RFCOMM (Raspberry Pi), eller som den parade serieporten systemet
// skapar åt det (Mac: /dev/cu.…). Samma gateway och samma telegramgräns i båda fallen.
const {values}=parseArgs({options:{adapter:{type:'string',default:'locobuffer'},device:{type:'string'},baud:{type:'string'},flow:{type:'string'},
  address:{type:'string'},channel:{type:'string',default:'1'},port:{type:'string',default:'8912'},help:{type:'boolean'}}});
if(values.help){console.log('node scripts/locobuffer-gateway.mjs --device /dev/... --baud 57600 --flow rtscts [--port 8912]\nnode scripts/locobuffer-gateway.mjs --adapter btlocobridge --address AA:BB:CC:DD:EE:FF [--channel 1] [--port 8912]\nLocal POSIX gateway, 8N1 over USB or RFCOMM to a paired BTLocoBridge. Explicit hardware settings required. No automatic replay or field-state synthesis.');process.exit(0);}
if(!['locobuffer','btlocobridge'].includes(values.adapter))throw Error('Okänd anslutning. Välj locobuffer eller btlocobridge. Se --help.');
if(!/^\d+$/.test(values.port)||Number(values.port)>65535)throw Error('Ange en giltig port. Se --help.');
const SPP={baud:'115200',flow:'none'};
let child;
if(values.adapter==='locobuffer'){
  if(!values.device||!['9600','19200','38400','57600','115200'].includes(values.baud)||!['none','rtscts'].includes(values.flow))throw Error('Ange enhet, verifierad baud och flödeskontroll. Se --help.');
  child=['serial-port.py','--device',values.device,'--baud',values.baud,'--flow',values.flow];
}else if(values.address?.startsWith('/dev/')){
  // Parad serieprofil: systemet har redan förbindelsen, och hastigheten saknar betydelse över Bluetooth.
  child=['serial-port.py','--device',values.address,'--baud',SPP.baud,'--flow',SPP.flow];
}else{
  if(!/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(values.address||'')||!/^\d+$/.test(values.channel)||Number(values.channel)<1||Number(values.channel)>30)throw Error('Ange kortets Bluetooth-adress AA:BB:CC:DD:EE:FF och kanal 1–30. Se --help.');
  child=['bluetooth-port.py','--address',values.address,'--channel',values.channel];
}
const serial=spawn(process.env.PYTHON||'python3',[fileURLToPath(new URL(child[0],import.meta.url)),...child.slice(1)],{stdio:['pipe','pipe','pipe']});
let stopping=false,ready=false,errors='';
const gateway=new SerialGateway({writeBytes:bytes=>{if(!ready||serial.stdin.destroyed||serial.stdin.writableLength>65536)throw Error('Serial unavailable');serial.stdin.write(bytes);},closeSerial:()=>{stopping=true;serial.kill('SIGTERM');}});
serial.stdout.on('data',bytes=>gateway.push(bytes));serial.stdin.on('error',()=>gateway.fail('Serial pipe failed'));
serial.stderr.on('data',chunk=>{errors+=chunk.toString();const rows=errors.split('\n');errors=rows.pop();if(errors.length>4096)gateway.fail('Serial status overflow');for(const line of rows){if(line==='READY'&&!ready){ready=true;gateway.listen(Number(values.port)).then(port=>console.log('LocoNet-gateway: 127.0.0.1:'+port)).catch(()=>gateway.fail('Local TCP port unavailable'));}else if(line)console.error(line);}});
serial.on('error',e=>{console.error(e.message);process.exitCode=1;gateway.fail('Serial process unavailable');});
serial.on('exit',code=>{if(!stopping){process.exitCode=code||1;gateway.fail('Serial process ended');}});
for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>gateway.close());
