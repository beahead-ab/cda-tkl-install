import net from 'node:net';
import {FrameReader,LineReader,fromHex,hex} from './protocol.mjs';

// One controlling client, bounded buffers, no retry of a possibly sent order.
// writeBytes accepts raw serial bytes. Only their actual echo produces SENT OK.
export class SerialGateway {
  constructor({writeBytes,closeSerial=()=>{},echoTimeoutMs=2000}) {
    this.writeBytes=writeBytes;this.closeSerial=closeSerial;this.echoTimeoutMs=echoTimeoutMs;this.closed=false;
    this.frames=new FrameReader(bytes=>this.receive(bytes),()=>this.output('ERROR MESSAGE Invalid serial frame'));
    this.server=net.createServer(socket=>this.accept(socket));
  }
  listen(port=8912){return new Promise((resolve,reject)=>{this.server.once('error',reject);this.server.listen(port,'127.0.0.1',()=>resolve(this.server.address().port));});}
  accept(socket) {
    if(this.closed||this.client){socket.end('ERROR Controller already connected\r\n');return;}
    this.client=socket;socket.setNoDelay(true);socket.write('VERSION Charlottendal serial gateway 1\r\n');
    const lines=new LineReader(line=>{
      try {
        if(this.pending)throw Error('Order already pending');
        if(!line.startsWith('SEND '))throw Error('Expected SEND');
        const bytes=fromHex(line.slice(5));this.pending=bytes;
        this.timer=setTimeout(()=>this.fail('Serial echo timeout'),this.echoTimeoutMs);
        this.writeBytes(bytes);
      } catch {this.fail('Invalid or overlapping order');}
    },()=>this.fail('Protocol line too long'));
    socket.on('data',data=>lines.push(data));socket.on('error',()=>{});
    socket.on('close',()=>{if(this.client===socket){this.client=null;if(this.pending)this.fail('Controller disconnected during order');}});
  }
  output(line){if(!this.client)return;if(this.client.writableLength>65536){this.fail('Slow controller');return;}this.client.write(line+'\r\n');}
  push(bytes){if(!this.closed)this.frames.push(bytes);}
  receive(bytes){this.output('RECEIVE '+hex(bytes));if(this.pending?.equals(bytes)){clearTimeout(this.timer);this.pending=null;this.output('SENT OK');}}
  fail(reason){if(this.closed)return;this.client?.end('SENT ERROR '+reason+'\r\n');this.close();}
  close(){if(this.closed)return;this.closed=true;clearTimeout(this.timer);this.pending=null;this.client?.end();if(this.client?.destroy)setTimeout(()=>this.client?.destroy(),100).unref();if(this.server.listening)this.server.close();this.closeSerial();}
}
