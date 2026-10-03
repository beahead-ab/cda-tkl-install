#!/usr/bin/env python3
"""Raw POSIX serial pipe. Explicit port settings; stdout is only bus bytes."""
import argparse, fcntl, os, select, signal, sys, termios, time

def run():
    p=argparse.ArgumentParser()
    p.add_argument('--device',required=True)
    p.add_argument('--baud',type=int,required=True,choices=[9600,19200,38400,57600,115200])
    p.add_argument('--flow',required=True,choices=['none','rtscts'])
    args=p.parse_args()
    fd=os.open(args.device,os.O_RDWR|os.O_NOCTTY|os.O_NONBLOCK)
    old=termios.tcgetattr(fd)
    def stop(*_): raise SystemExit(0)
    signal.signal(signal.SIGTERM,stop);signal.signal(signal.SIGINT,stop)
    try:
        if not os.isatty(fd): raise ValueError('Device is not a serial terminal')
        fcntl.ioctl(fd,termios.TIOCEXCL)
        flags=termios.CLOCAL|termios.CREAD|termios.CS8
        if args.flow=='rtscts':
            flow=getattr(termios,'CRTSCTS',0)
            if not flow: raise ValueError('RTS/CTS is unavailable on this platform')
            flags|=flow
        mode=termios.tcgetattr(fd)
        mode[:6]=[0,0,flags,0,getattr(termios,'B'+str(args.baud)),getattr(termios,'B'+str(args.baud))]
        mode[6][termios.VMIN]=0;mode[6][termios.VTIME]=0
        termios.tcsetattr(fd,termios.TCSANOW,mode)
        termios.tcflush(fd,termios.TCIOFLUSH)
        os.set_blocking(0,False);os.set_blocking(1,False)
        sys.stderr.write('READY\n');sys.stderr.flush()
        outgoing=bytearray();incoming=bytearray();deadline=0
        while True:
            readable,writable,_=select.select([fd,0],[fd] if outgoing else [],[],0.05)
            if 0 in readable:
                data=os.read(0,4096)
                if not data:return
                if not outgoing:deadline=time.monotonic()+2
                outgoing.extend(data)
            if fd in readable:
                data=os.read(fd,4096)
                if not data:raise OSError('Serial device disconnected')
                incoming.extend(data)
            if fd in writable:
                try:del outgoing[:os.write(fd,outgoing)]
                except BlockingIOError:pass
            if incoming:
                try:del incoming[:os.write(1,incoming)]
                except BlockingIOError:pass
            if len(outgoing)>65536 or len(incoming)>65536:raise OSError('Serial queue exceeded limit')
            if outgoing and time.monotonic()>deadline:raise OSError('Serial write timeout')
    finally:
        try:termios.tcflush(fd,termios.TCOFLUSH);termios.tcsetattr(fd,termios.TCSANOW,old)
        except OSError:pass
        os.close(fd)

if __name__=='__main__':
    try:run()
    except Exception as e:sys.stderr.write(str(e)+'\n');sys.exit(1)
