#!/usr/bin/env python3
"""Raw RFCOMM pipe to a paired Bluetooth adapter (BTLocoBridge). stdout is only bus bytes."""
import argparse, os, select, signal, socket, sys, time

def run():
    p=argparse.ArgumentParser()
    p.add_argument('--address',required=True)
    p.add_argument('--channel',type=int,default=1,choices=range(1,31))
    args=p.parse_args()
    address=args.address.upper()
    if len(address)!=17 or any(len(part)!=2 or any(c not in '0123456789ABCDEF' for c in part) for part in address.split(':')) or address.count(':')!=5:
        raise ValueError('Ange kortets Bluetooth-adress som AA:BB:CC:DD:EE:FF')
    if not hasattr(socket,'AF_BLUETOOTH') or not hasattr(socket,'BTPROTO_RFCOMM'):
        raise OSError('Bluetooth RFCOMM saknas i den här Python-byggnaden. Para kortet i systemet och ange dess /dev-enhet i stället')
    sock=socket.socket(socket.AF_BLUETOOTH,socket.SOCK_STREAM,socket.BTPROTO_RFCOMM)
    def stop(*_): raise SystemExit(0)
    signal.signal(signal.SIGTERM,stop);signal.signal(signal.SIGINT,stop)
    try:
        # Kortet ska redan vara parat i systemet; det här öppnar bara förbindelsen till dess serieprofil.
        sock.settimeout(20)
        sock.connect((address,args.channel))
        sock.setblocking(False)
        os.set_blocking(0,False);os.set_blocking(1,False)
        sys.stderr.write('READY\n');sys.stderr.flush()
        outgoing=bytearray();incoming=bytearray();deadline=0
        while True:
            readable,writable,_=select.select([sock,0],[sock] if outgoing else [],[],0.05)
            if 0 in readable:
                data=os.read(0,4096)
                if not data:return
                if not outgoing:deadline=time.monotonic()+2
                outgoing.extend(data)
            if sock in readable:
                try:data=sock.recv(4096)
                except BlockingIOError:data=b''
                else:
                    if not data:raise OSError('Bluetooth-förbindelsen bröts')
                incoming.extend(data)
            if sock in writable:
                try:del outgoing[:sock.send(outgoing)]
                except BlockingIOError:pass
            if incoming:
                try:del incoming[:os.write(1,incoming)]
                except BlockingIOError:pass
            if len(outgoing)>65536 or len(incoming)>65536:raise OSError('Bluetooth queue exceeded limit')
            if outgoing and time.monotonic()>deadline:raise OSError('Bluetooth write timeout')
    finally:
        try:sock.close()
        except OSError:pass

if __name__=='__main__':
    try:run()
    except Exception as e:sys.stderr.write(str(e)+'\n');sys.exit(1)
