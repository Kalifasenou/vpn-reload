/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Shield, 
  Network, 
  Zap, 
  Code2, 
  Info, 
  ArrowRight, 
  Server, 
  Lock, 
  Smartphone,
  Layers,
  Terminal,
  ChevronRight,
  Github,
  Settings as SettingsIcon,
  Menu,
  X,
  Activity,
  Globe,
  Cpu
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

// --- Constants & Types ---

type Section = 'overview' | 'simulator' | 'vpn-service' | 'injector' | 'tun2socks' | 'ssh-tunnel' | 'resilience' | 'flow' | 'settings';

const KOTLIN_VPN_SERVICE = `
package com.example.nettunnel.service

import android.net.VpnService
import android.os.ParcelFileDescriptor
import android.util.Log
import com.example.nettunnel.core.Tun2Socks
import java.io.FileInputStream
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.io.IOException

/**
 * Core VPN Service with Error Handling and Auto-Reconnection logic.
 */
class NetTunnelService : VpnService() {

    private var vpnInterface: ParcelFileDescriptor? = null
    private var isRunning = false
    private val TAG = "NetTunnelService"
    private var tun2Socks: Tun2Socks? = null

    override fun onStartCommand(intent: android.content.Intent?, flags: Int, startId: Int): Int {
        isRunning = true
        Thread { startVpnLoop() }.start()
        return START_STICKY
    }

    private fun startVpnLoop() {
        while (isRunning) {
            try {
                Log.d(TAG, "Attempting to establish VPN interface...")
                establishVpn()
                
                // Initialize Tun2Socks with the TUN file descriptor
                tun2Socks = Tun2Socks()
                tun2Socks?.start(vpnInterface!!.fileDescriptor, 1080) // SOCKS port 1080
                
                processPackets()
            } catch (e: Exception) {
                Log.e(TAG, "VPN Loop Error: \${e.message}. Reconnecting in 5s...")
                cleanup()
                Thread.sleep(5000) // Auto-reconnection delay
            }
        }
    }

    private fun establishVpn(dnsPrimary: String = "8.8.8.8", dnsSecondary: String = "8.8.4.4") {
        val builder = Builder()
        builder.addAddress("10.0.0.2", 24)
        builder.addRoute("0.0.0.0", 0)
        
        // Configurable DNS Settings
        builder.addDnsServer(dnsPrimary)
        builder.addDnsServer(dnsSecondary)
        
        builder.setMtu(1500)
        builder.setSession("NetTunnel")
        
        vpnInterface = builder.establish() ?: throw IOException("Failed to establish TUN interface")
    }

    private fun processPackets() {
        val fd = vpnInterface?.fileDescriptor ?: return
        val input = FileInputStream(fd).channel
        val buffer = ByteBuffer.allocate(16384)

        while (isRunning) {
            buffer.clear()
            val length = input.read(buffer)
            if (length > 0) {
                buffer.flip()
                // In a real implementation, Tun2Socks handles the read/write loop
                // but here we show the conceptual flow.
                tun2Socks?.processIncoming(buffer)
            }
        }
    }

    private fun cleanup() {
        try {
            tun2Socks?.stop()
            vpnInterface?.close()
            vpnInterface = null
        } catch (e: Exception) { /* Ignore */ }
    }

    override fun onDestroy() {
        isRunning = false
        cleanup()
        super.onDestroy()
    }
}
`;

const KOTLIN_INJECTOR = `
package com.example.nettunnel.core

import java.net.Socket
import java.io.OutputStream
import java.util.regex.Pattern

/**
 * Advanced Payload Injector: Robust against detection with dynamic placeholders.
 */
class PayloadInjector(private val rawPayload: String) {

    fun inject(targetHost: String, targetPort: Int, method: String = "CONNECT"): Socket {
        val socket = Socket(targetHost, targetPort)
        val out: OutputStream = socket.getOutputStream()

        // Advanced Payload Manipulation
        val formattedPayload = formatPayload(rawPayload, targetHost, targetPort, method)

        out.write(formattedPayload.toByteArray())
        out.flush()
        
        return socket
    }

    private fun formatPayload(payload: String, host: String, port: Int, method: String): String {
        return payload
            .replace("[host]", host)
            .replace("[port]", port.toString())
            .replace("[protocol]", "HTTP/1.1")
            .replace("[method]", method)
            .replace("[crlf]", "\\r\\n")
            .replace("[lf]", "\\n")
            .replace("[cr]", "\\r")
            .replace("[ua]", "Mozilla/5.0 (Android 13; Mobile; rv:109.0) Gecko/110.0 Firefox/110.0")
            .replace("[random]", (1000..9999).random().toString())
            .replace("[auth]", "Basic " + java.util.Base64.getEncoder().encodeToString("user:pass".toByteArray()))
            .replace("[split]", "\\r\\n\\r\\n") // For sophisticated header splitting
    }
}
`;

const KOTLIN_SSH_TUNNEL = `
package com.example.nettunnel.tunnel

import android.util.Log
import com.jcraft.jsch.JSch
import com.jcraft.jsch.Session
import java.util.Properties
import kotlin.math.pow

/**
 * SSH Tunneling with Exponential Backoff and UDP Forwarding.
 */
class SshTunnelManager {

    private var session: Session? = null
    private val TAG = "SshTunnel"
    private var isConnecting = false

    fun startTunnel(host: String, port: Int, user: String, pass: String, enableUdp: Boolean = false) {
        Thread {
            var attempt = 0
            isConnecting = true
            while (!isConnected() && isConnecting) {
                try {
                    attempt++
                    Log.i(TAG, "Connection attempt #\$attempt to \$host...")
                    connect(host, port, user, pass)
                    
                    if (enableUdp) {
                        setupUdpForwarding()
                    }
                    
                    Log.i(TAG, "SSH Tunnel established successfully.")
                    break
                } catch (e: Exception) {
                    val delay = (2.0.pow(attempt.toDouble()) * 1000).toLong().coerceAtMost(30000)
                    Log.e(TAG, "Connection failed: \${e.message}. Retrying in \${delay/1000}s...")
                    Thread.sleep(delay)
                }
            }
        }.start()
    }

    private fun connect(host: String, port: Int, user: String, pass: String) {
        val jsch = JSch()
        session = jsch.getSession(user, host, port)
        session?.password = pass

        val config = Properties()
        config["StrictHostKeyChecking"] = "no"
        session?.setConfig(config)

        // Dynamic Port Forwarding (SOCKS proxy)
        session?.connect(10000) // 10s timeout
        session?.setPortForwardingD(1080)
    }

    /**
     * Conceptual UDP-over-TCP Gateway.
     * SSH doesn't natively support UDP forwarding. 
     * We use a UDP-to-TCP bridge (like badvpn-udpgw).
     */
    private fun setupUdpForwarding() {
        Log.i(TAG, "Initializing UDP-over-TCP Gateway (UDPGW)...")
        // Logic to tunnel UDP packets through the established SSH TCP connection
        // Typically involves listening on a local port and wrapping UDP in TCP
    }

    fun isConnected(): Boolean = session?.isConnected ?: false

    fun disconnect() {
        isConnecting = false
        session?.disconnect()
        session = null
    }
}
`;

const KOTLIN_TUN2SOCKS = `
package com.example.nettunnel.core

import java.io.FileDescriptor
import java.nio.ByteBuffer

/**
 * Tun2Socks: Translates Layer 3 (IP) packets from TUN to Layer 4 (SOCKS) streams.
 * This implementation bridges to a native TCP/IP stack (e.g., lwIP).
 */
class Tun2Socks {

    // Native methods implemented in C++/Go
    private external fun nativeStart(tunFd: Int, socksPort: Int): Long
    private external fun nativeStop(handle: Long)
    private external fun nativeProcessPacket(handle: Long, data: ByteArray, length: Int)

    private var nativeHandle: Long = 0

    companion object {
        init {
            System.loadLibrary("tun2socks-native")
        }
    }

    fun start(tunFileDescriptor: FileDescriptor, socksPort: Int) {
        // Extract integer FD from FileDescriptor object via reflection or JNI
        val fd = getFd(tunFileDescriptor)
        nativeHandle = nativeStart(fd, socksPort)
    }

    fun processIncoming(buffer: ByteBuffer) {
        if (nativeHandle == 0L) return
        
        val data = ByteArray(buffer.remaining())
        buffer.get(data)
        nativeProcessPacket(nativeHandle, data, data.size)
    }

    fun stop() {
        if (nativeHandle != 0L) {
            nativeStop(nativeHandle)
            nativeHandle = 0
        }
    }

    private fun getFd(fd: FileDescriptor): Int {
        // Conceptual: In Android, you'd use a JNI helper to get the int FD
        return 0 
    }
}
`;

const DATA_FLOW_STEPS = [
  { id: 1, label: 'App/Browser', icon: Smartphone, desc: 'Generates network request (TCP/UDP)' },
  { id: 2, label: 'TUN Interface', icon: Shield, desc: 'VpnService intercepts raw IP packets' },
  { id: 3, label: 'Tun2Socks', icon: Layers, desc: 'Converts Layer 3 (IP) to Layer 4 (TCP/SOCKS)' },
  { id: 4, label: 'Injector', icon: Zap, desc: 'Modifies headers with custom Payload' },
  { id: 5, label: 'SSH Tunnel', icon: Lock, desc: 'Encapsulates & encrypts traffic' },
  { id: 6, label: 'Remote Server', icon: Server, desc: 'Decapsulates and forwards to Internet' },
];

// --- Components ---

const Header = ({ onMenuClick }: { onMenuClick: () => void }) => (
  <header className="border-b border-zinc-800 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-50">
    <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="lg:hidden p-2 -ml-2 text-zinc-400 hover:text-zinc-100">
          <Menu className="w-5 h-5" />
        </button>
        <div className="w-8 h-8 bg-orange-600 rounded flex items-center justify-center">
          <Network className="text-white w-5 h-5" />
        </div>
        <h1 className="font-mono text-lg font-bold tracking-tighter text-zinc-100 uppercase">
          NetTunnel <span className="text-orange-500">Architect</span>
        </h1>
      </div>
      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-full">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">System Ready</span>
        </div>
        <nav className="hidden md:flex items-center gap-6">
          <a href="#" className="text-xs font-mono text-zinc-400 hover:text-zinc-100 transition-colors uppercase tracking-widest">Docs</a>
          <Github className="w-5 h-5 text-zinc-400 hover:text-zinc-100 cursor-pointer" />
        </nav>
      </div>
    </div>
  </header>
);

const Sidebar = ({ active, setActive, isOpen, setIsOpen }: { active: Section, setActive: (s: Section) => void, isOpen: boolean, setIsOpen: (b: boolean) => void }) => {
  const items: { id: Section, label: string, icon: any }[] = [
    { id: 'overview', label: 'Architecture Overview', icon: Info },
    { id: 'simulator', label: 'Live Simulator', icon: Smartphone },
    { id: 'vpn-service', label: 'VpnService (Core)', icon: Shield },
    { id: 'injector', label: 'Payload Injector', icon: Zap },
    { id: 'tun2socks', label: 'Tun2Socks Logic', icon: Layers },
    { id: 'ssh-tunnel', label: 'SSH Tunneling', icon: Lock },
    { id: 'resilience', label: 'Resilience & Reconnect', icon: Zap },
    { id: 'flow', label: 'Data Flow Map', icon: Network },
    { id: 'settings', label: 'Global Settings', icon: SettingsIcon },
  ];

  return (
    <>
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <aside className={`
        fixed lg:relative inset-y-0 left-0 w-64 border-r border-zinc-800 bg-zinc-950 lg:bg-transparent z-50 transform transition-transform duration-300 lg:translate-x-0 p-6
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between mb-8 lg:hidden">
          <h2 className="font-mono text-sm font-bold text-zinc-100 uppercase tracking-widest">Menu</h2>
          <button onClick={() => setIsOpen(false)} className="p-2 text-zinc-500 hover:text-zinc-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-1">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActive(item.id);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-mono transition-all ${
                active === item.id 
                  ? 'bg-orange-600/10 text-orange-500 border border-orange-600/20' 
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </div>
      </aside>
    </>
  );
};

const CodeBlock = ({ code, language = 'kotlin' }: { code: string, language?: string }) => (
  <div className="rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950 my-4">
    <div className="bg-zinc-900 px-4 py-2 border-b border-zinc-800 flex items-center justify-between">
      <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest">{language}</span>
      <Code2 className="w-4 h-4 text-zinc-600" />
    </div>
    <SyntaxHighlighter 
      language={language} 
      style={vscDarkPlus}
      customStyle={{ margin: 0, padding: '1.5rem', fontSize: '0.85rem', background: 'transparent' }}
    >
      {code.trim()}
    </SyntaxHighlighter>
  </div>
);

const FlowDiagram = ({ onStepClick }: { onStepClick: (s: Section) => void }) => (
  <div className="py-12 px-6">
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 relative">
      {DATA_FLOW_STEPS.map((step, idx) => {
        const sectionMap: Record<number, Section> = {
          1: 'simulator',
          2: 'vpn-service',
          3: 'tun2socks',
          4: 'injector',
          5: 'ssh-tunnel',
          6: 'overview'
        };
        return (
          <div key={step.id} className="relative group">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              onClick={() => onStepClick(sectionMap[step.id])}
              className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl h-full flex flex-col items-center text-center group-hover:border-orange-500/50 transition-all cursor-pointer hover:-translate-y-1"
            >
              <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mb-4 group-hover:bg-orange-600/20 transition-colors">
                <step.icon className="w-6 h-6 text-zinc-400 group-hover:text-orange-500" />
              </div>
              <h3 className="text-xs font-mono font-bold text-zinc-100 uppercase mb-2">{step.label}</h3>
              <p className="text-[10px] text-zinc-500 leading-relaxed">{step.desc}</p>
            </motion.div>
            {idx < DATA_FLOW_STEPS.length - 1 && (
              <div className="hidden lg:block absolute top-1/2 -right-2 transform -translate-y-1/2 z-10">
                <ArrowRight className="w-4 h-4 text-zinc-700" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  </div>
);

import { LineChart, Line, ResponsiveContainer, YAxis, XAxis, Tooltip } from 'recharts';

const LiveSimulator = () => {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error' | 'reconnecting'>('idle');
  const [logs, setLogs] = useState<{ time: string, msg: string, type: 'info' | 'debug' | 'success' | 'error' }[]>([]);
  const [payload, setPayload] = useState('GET / HTTP/1.1[crlf]Host: m.facebook.com[crlf]Connection: Keep-Alive[crlf][crlf]');
  const [traffic, setTraffic] = useState<{ time: number, val: number }[]>([]);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [isRealMode, setIsRealMode] = useState(false);
  const [sshConfig, setSshConfig] = useState({ host: '192.168.1.100', port: '22', user: 'root', pass: '' });
  const [targetConfig, setTargetConfig] = useState({ host: 'm.facebook.com', port: '80' });
  const [realResponse, setRealResponse] = useState<string | null>(null);
  const [dnsConfig, setDnsConfig] = useState({ primary: '8.8.8.8', secondary: '8.8.4.4' });
  const [enableUdp, setEnableUdp] = useState(false);
  const [httpMethod, setHttpMethod] = useState('CONNECT');

  const presets = [
    { name: 'FB Zero', payload: 'GET / HTTP/1.1[crlf]Host: m.facebook.com[crlf]Connection: Keep-Alive[crlf][crlf]' },
    { name: 'Cloudflare', payload: 'CONNECT [host]:[port] [protocol][crlf]Host: 1.1.1.1[crlf][crlf]' },
    { name: 'Direct', payload: 'CONNECT [host]:[port] [protocol][crlf][crlf]' },
  ];

  const addLog = (msg: string, type: 'info' | 'debug' | 'success' | 'error' = 'info') => {
    setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), msg, type }].slice(-10));
  };

  const runRealBypass = async () => {
    setStatus('connecting');
    setLogs([]);
    setRealResponse(null);
    addLog('REAL MODE: Initializing real network connection...', 'info');
    
    try {
      // 1. Test SSH Handshake
      addLog(`REAL MODE: Attempting SSH handshake to ${sshConfig.host}:${sshConfig.port}...`, 'debug');
      const sshRes = await fetch('/api/test-ssh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sshConfig)
      });
      const sshData = await sshRes.json();
      
      if (!sshData.success) {
        throw new Error(`SSH Error: ${sshData.error}`);
      }
      addLog('REAL MODE: SSH Handshake successful!', 'success');

      // 2. Test Payload Injection
      addLog(`REAL MODE: Injecting payload [${httpMethod}] to ${targetConfig.host}:${targetConfig.port}...`, 'debug');
      const payloadRes = await fetch('/api/test-payload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: targetConfig.host,
          port: parseInt(targetConfig.port),
          payload,
          method: httpMethod
        })
      });
      const payloadData = await payloadRes.json();

      if (payloadData.error) {
        throw new Error(`Payload Error: ${payloadData.error}`);
      }

      addLog('REAL MODE: Payload injected and response received!', 'success');
      setRealResponse(payloadData.response);
      setStatus('connected');
      startTrafficSimulation();
    } catch (err: any) {
      addLog(`REAL MODE ERROR: ${err.message}`, 'error');
      setStatus('error');
    }
  };

  const simulateConnection = async (isReconnect = false) => {
    if (isRealMode) {
      return runRealBypass();
    }
    if (!isReconnect) {
      setStatus('connecting');
      setLogs([]);
      setReconnectAttempt(0);
      addLog('SIMULATION: Initializing NetTunnel VpnService...', 'info');
    } else {
      setStatus('reconnecting');
      addLog(`SIMULATION: Reconnection attempt #${reconnectAttempt + 1}...`, 'info');
    }

    await new Promise(r => setTimeout(r, 800));
    if (!isReconnect) {
      addLog('SIMULATION: TUN Interface established: 10.0.0.2/24', 'success');
      addLog(`SIMULATION: Pushing DNS: ${dnsConfig.primary}, ${dnsConfig.secondary}`, 'info');
    }
    
    await new Promise(r => setTimeout(r, 600));
    if (!isReconnect) addLog('SIMULATION: Starting Tun2Socks engine (lwIP stack)...', 'info');
    
    await new Promise(r => setTimeout(r, 1000));
    addLog('SIMULATION: SSH Handshake initiated: user@192.168.1.100:22', 'debug');
    if (enableUdp) addLog('SIMULATION: Initializing UDP-over-TCP Gateway (UDPGW)...', 'debug');
    addLog(`SIMULATION: Injecting Payload [${httpMethod}]: ${payload.substring(0, 30)}...`, 'debug');
    await new Promise(r => setTimeout(r, 1200));
    
    if (payload.toLowerCase().includes('host:')) {
      addLog('SIMULATION: DPI Bypass successful: Whitelisted host detected.', 'success');
      addLog('SIMULATION: SSH Tunnel established. SOCKS5 proxy at 127.0.0.1:1080', 'success');
      setStatus('connected');
      setReconnectAttempt(0);
      startTrafficSimulation();
    } else {
      addLog('SIMULATION: Connection failed: DPI blocked non-whitelisted traffic.', 'error');
      setStatus('error');
    }
  };

  const simulateDrop = async () => {
    setStatus('error');
    addLog('Network connection lost! SSH session terminated.', 'error');
    addLog('VpnService: Monitoring network state...', 'info');
    
    let attempt = 0;
    const maxAttempts = 3;
    
    const runReconnect = async () => {
      if (attempt < maxAttempts) {
        attempt++;
        setReconnectAttempt(attempt);
        const delay = Math.pow(2, attempt) * 1000;
        addLog(`Exponential backoff: Waiting ${delay/1000}s before retry...`, 'debug');
        await new Promise(r => setTimeout(r, delay));
        await simulateConnection(true);
      }
    };
    
    runReconnect();
  };

  const startTrafficSimulation = () => {
    let count = 0;
    const interval = setInterval(() => {
      setTraffic(prev => [...prev, { time: count++, val: Math.random() * 100 }].slice(-20));
    }, 500);
    return () => clearInterval(interval);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div className="xl:col-span-2 space-y-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-mono font-bold text-zinc-100 uppercase">Connection Config</h3>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-zinc-500 uppercase">Real Mode</span>
                <button 
                  onClick={() => setIsRealMode(!isRealMode)}
                  className={`w-10 h-5 rounded-full relative transition-colors ${isRealMode ? 'bg-orange-600' : 'bg-zinc-800'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isRealMode ? 'right-1' : 'left-1'}`} />
                </button>
              </div>
              <div className={`px-2 py-1 rounded text-[10px] font-mono uppercase ${
                status === 'connected' ? 'bg-green-500/20 text-green-500' : 
                status === 'connecting' || status === 'reconnecting' ? 'bg-orange-500/20 text-orange-500 animate-pulse' :
                status === 'error' ? 'bg-red-500/20 text-red-500' : 'bg-zinc-800 text-zinc-500'
              }`}>
                {status}
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-mono text-zinc-500 uppercase">SSH Host</label>
              <input 
                type="text" 
                value={sshConfig.host} 
                onChange={(e) => setSshConfig({...sshConfig, host: e.target.value})}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm font-mono text-zinc-300 focus:outline-none focus:border-orange-500" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-mono text-zinc-500 uppercase">SSH Port</label>
              <input 
                type="text" 
                value={sshConfig.port} 
                onChange={(e) => setSshConfig({...sshConfig, port: e.target.value})}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm font-mono text-zinc-300 focus:outline-none focus:border-orange-500" 
              />
            </div>
          </div>

          {isRealMode && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-mono text-zinc-500 uppercase">SSH User</label>
                <input 
                  type="text" 
                  value={sshConfig.user} 
                  onChange={(e) => setSshConfig({...sshConfig, user: e.target.value})}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm font-mono text-zinc-300 focus:outline-none focus:border-orange-500" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-mono text-zinc-500 uppercase">SSH Password</label>
                <input 
                  type="password" 
                  value={sshConfig.pass} 
                  onChange={(e) => setSshConfig({...sshConfig, pass: e.target.value})}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm font-mono text-zinc-300 focus:outline-none focus:border-orange-500" 
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-mono text-zinc-500 uppercase">Primary DNS</label>
              <input 
                type="text" 
                value={dnsConfig.primary} 
                onChange={(e) => setDnsConfig({...dnsConfig, primary: e.target.value})}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm font-mono text-zinc-300 focus:outline-none focus:border-orange-500" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-mono text-zinc-500 uppercase">Secondary DNS</label>
              <input 
                type="text" 
                value={dnsConfig.secondary} 
                onChange={(e) => setDnsConfig({...dnsConfig, secondary: e.target.value})}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm font-mono text-zinc-300 focus:outline-none focus:border-orange-500" 
              />
            </div>
          </div>

          <div className="flex items-center gap-6 py-2">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-zinc-500 uppercase">UDP Forwarding</span>
              <button 
                onClick={() => setEnableUdp(!enableUdp)}
                className={`w-10 h-5 rounded-full relative transition-colors ${enableUdp ? 'bg-orange-600' : 'bg-zinc-800'}`}
              >
                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${enableUdp ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-zinc-500 uppercase">HTTP Method</span>
              <select 
                value={httpMethod}
                onChange={(e) => setHttpMethod(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[10px] font-mono text-zinc-300 focus:outline-none focus:border-orange-500"
              >
                <option value="CONNECT">CONNECT</option>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="HEAD">HEAD</option>
              </select>
            </div>
          </div>

          {isRealMode && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-mono text-zinc-500 uppercase">Target Host</label>
                <input 
                  type="text" 
                  value={targetConfig.host} 
                  onChange={(e) => setTargetConfig({...targetConfig, host: e.target.value})}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm font-mono text-zinc-300 focus:outline-none focus:border-orange-500" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-mono text-zinc-500 uppercase">Target Port</label>
                <input 
                  type="text" 
                  value={targetConfig.port} 
                  onChange={(e) => setTargetConfig({...targetConfig, port: e.target.value})}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm font-mono text-zinc-300 focus:outline-none focus:border-orange-500" 
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-mono text-zinc-500 uppercase">HTTP Payload (Injector)</label>
              <div className="flex gap-2">
                {presets.map(p => (
                  <button 
                    key={p.name}
                    onClick={() => setPayload(p.payload)}
                    className="text-[8px] font-mono px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded border border-zinc-700 transition-colors"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
            <textarea 
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              className="w-full h-24 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono text-orange-400 focus:outline-none focus:border-orange-500 resize-none"
            />
          </div>

          <div className="flex gap-4">
            <button 
              onClick={status === 'connected' ? () => setStatus('idle') : () => simulateConnection()}
              className={`flex-1 py-3 rounded-xl font-mono font-bold uppercase tracking-widest transition-all ${
                status === 'connected' ? 'bg-red-600/20 text-red-500 border border-red-600/50 hover:bg-red-600/30' : 
                'bg-orange-600 text-white hover:bg-orange-500 shadow-lg shadow-orange-600/20'
              }`}
            >
              {status === 'connected' ? 'Disconnect Tunnel' : 'Initialize Tunnel'}
            </button>
            {status === 'connected' && (
              <button 
                onClick={simulateDrop}
                className="px-4 py-3 rounded-xl bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700 transition-all font-mono text-[10px] uppercase"
              >
                Drop Net
              </button>
            )}
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-mono font-bold text-zinc-100 uppercase flex items-center gap-2">
            <Terminal className="w-4 h-4 text-zinc-500" />
            System Logs {isRealMode && <span className="text-[8px] text-orange-500">(REAL MODE)</span>}
          </h3>
          <div className="bg-zinc-950 rounded-lg p-4 h-48 overflow-y-auto font-mono text-[10px] space-y-1 border border-zinc-800">
            {logs.length === 0 && <span className="text-zinc-700 italic">Waiting for connection...</span>}
            {logs.map((log, i) => (
              <div key={i} className="flex gap-3">
                <span className="text-zinc-600">[{log.time}]</span>
                <span className={
                  log.type === 'success' ? 'text-green-500' :
                  log.type === 'error' ? 'text-red-500' :
                  log.type === 'debug' ? 'text-blue-400' : 'text-zinc-400'
                }>{log.msg}</span>
              </div>
            ))}
          </div>
          {realResponse && (
            <div className="space-y-2">
              <label className="text-[10px] font-mono text-zinc-500 uppercase">Real Server Response</label>
              <div className="bg-zinc-950 rounded-lg p-4 h-32 overflow-y-auto font-mono text-[10px] text-orange-300 border border-zinc-800 whitespace-pre">
                {realResponse}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-mono font-bold text-zinc-100 uppercase">Traffic Monitor</h3>
          <div className="h-32 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={traffic}>
                <Line type="monotone" dataKey="val" stroke="#f97316" strokeWidth={2} dot={false} isAnimationActive={false} />
                <YAxis hide domain={[0, 100]} />
                <XAxis hide />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-between text-[10px] font-mono text-zinc-500 uppercase">
            <span>Down: {status === 'connected' ? (Math.random() * 5).toFixed(2) : '0.00'} MB/s</span>
            <span>Up: {status === 'connected' ? (Math.random() * 1).toFixed(2) : '0.00'} MB/s</span>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-mono font-bold text-zinc-100 uppercase">Bypass Analysis</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-zinc-500 uppercase">DPI Stealth</span>
              <span className="text-[10px] font-mono text-orange-500">85%</span>
            </div>
            <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-orange-500" style={{ width: '85%' }} />
            </div>
            <p className="text-[10px] text-zinc-500 leading-relaxed italic">
              "The current payload uses a whitelisted Host header which significantly increases the probability of bypassing stateful packet inspection."
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [activeSection, setActiveSection] = useState<Section>('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 font-sans selection:bg-orange-500/30">
      <Header onMenuClick={() => setIsSidebarOpen(true)} />
      
      <div className="max-w-7xl mx-auto flex">
        <Sidebar active={activeSection} setActive={setActiveSection} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
        
        <main className="flex-1 p-6 md:p-12 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeSection === 'simulator' && (
                <section className="space-y-8">
                  <div className="space-y-2">
                    <h2 className="text-3xl font-mono font-bold text-zinc-100 uppercase tracking-tighter">Live <span className="text-orange-500">Simulator</span></h2>
                    <p className="text-zinc-500 text-sm font-mono uppercase tracking-widest">Real-time Tunneling & Injection Testbed</p>
                  </div>
                  <LiveSimulator />
                </section>
              )}

              {activeSection === 'overview' && (
                <section className="space-y-8">
                  <div className="space-y-4">
                    <h2 className="text-4xl font-mono font-bold text-zinc-100 tracking-tighter uppercase">
                      Architecture <span className="text-orange-500">Blueprint</span>
                    </h2>
                    <p className="text-lg text-zinc-400 max-w-2xl leading-relaxed">
                      This Proof of Concept (PoC) explores the intersection of Android system APIs and network protocol manipulation. 
                      The goal is to intercept Layer 3 traffic and tunnel it through an encrypted SSH Layer 4 stream with custom header injection.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
                      <div className="w-10 h-10 rounded-lg bg-orange-600/20 flex items-center justify-center">
                        <Shield className="text-orange-500 w-5 h-5" />
                      </div>
                      <h3 className="text-lg font-mono font-bold text-zinc-100 uppercase">System Interception</h3>
                      <p className="text-sm text-zinc-500 leading-relaxed">
                        Utilizing <code className="text-orange-400">VpnService</code> to create a virtual TUN interface. 
                        This allows the app to capture raw IP packets without root access, acting as the gateway for all device traffic.
                      </p>
                    </div>
                    <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
                      <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
                        <Zap className="text-blue-500 w-5 h-5" />
                      </div>
                      <h3 className="text-lg font-mono font-bold text-zinc-100 uppercase">Header Injection</h3>
                      <p className="text-sm text-zinc-500 leading-relaxed">
                        The "Injector" modifies HTTP/SNI headers during the initial handshake. 
                        By spoofing whitelisted hosts, traffic can bypass Deep Packet Inspection (DPI) filters.
                      </p>
                    </div>
                  </div>

                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 space-y-6">
                    <h3 className="text-xl font-mono font-bold text-zinc-100 uppercase flex items-center gap-3">
                      <Terminal className="w-5 h-5 text-zinc-500" />
                      The DPI Bypass Theory
                    </h3>
                    <div className="prose prose-invert max-w-none text-zinc-400 text-sm leading-relaxed space-y-4">
                      <p>
                        Deep Packet Inspection (DPI) works by analyzing the first few bytes of a connection. 
                        In many restricted networks, certain domains (like Facebook, WhatsApp, or educational sites) are "zero-rated" or whitelisted.
                      </p>
                      <p>
                        By injecting a custom HTTP payload (e.g., <code className="bg-zinc-800 px-1 rounded text-orange-400">CONNECT m.facebook.com:443 HTTP/1.1</code>) 
                        before the SSH handshake, the network firewall identifies the connection as legitimate traffic to a whitelisted host.
                      </p>
                      <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-800 font-mono text-xs text-zinc-500">
                        [OUTGOING PACKET]<br/>
                        &gt; GET / HTTP/1.1<br/>
                        &gt; Host: whitelisted-domain.com<br/>
                        &gt; Connection: Keep-Alive<br/>
                        &gt; [SSH HANDSHAKE STARTS HERE]
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {activeSection === 'vpn-service' && (
                <section className="space-y-6">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 rounded-xl bg-orange-600/20 flex items-center justify-center">
                      <Shield className="text-orange-500 w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-mono font-bold text-zinc-100 uppercase tracking-tighter">VpnService Core</h2>
                      <p className="text-zinc-500 text-sm font-mono uppercase tracking-widest">Layer 3 Interception (Network Layer)</p>
                    </div>
                  </div>
                  <p className="text-zinc-400 leading-relaxed max-w-3xl">
                    The <code className="text-orange-400">VpnService</code> is the entry point. It creates a virtual network interface (TUN). 
                    We configure it to route all traffic (<code className="text-zinc-500">0.0.0.0/0</code>) into our application.
                  </p>
                  <CodeBlock code={KOTLIN_VPN_SERVICE} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                    <div className="p-4 border border-zinc-800 rounded-lg bg-zinc-900/30">
                      <h4 className="text-xs font-mono font-bold text-zinc-100 uppercase mb-2">ParcelFileDescriptor</h4>
                      <p className="text-xs text-zinc-500">Provides a file handle to the TUN interface. Reading from it gives raw IP packets; writing to it sends packets back to the system.</p>
                    </div>
                    <div className="p-4 border border-zinc-800 rounded-lg bg-zinc-900/30">
                      <h4 className="text-xs font-mono font-bold text-zinc-100 uppercase mb-2">MTU (1500)</h4>
                      <p className="text-xs text-zinc-500">Maximum Transmission Unit. Standard size for Ethernet packets. Crucial for avoiding fragmentation issues.</p>
                    </div>
                  </div>
                </section>
              )}

              {activeSection === 'injector' && (
                <section className="space-y-6">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 rounded-xl bg-blue-600/20 flex items-center justify-center">
                      <Zap className="text-blue-500 w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-mono font-bold text-zinc-100 uppercase tracking-tighter">Payload Injector</h2>
                      <p className="text-zinc-500 text-sm font-mono uppercase tracking-widest">Application Layer Manipulation</p>
                    </div>
                  </div>
                  <p className="text-zinc-400 leading-relaxed max-w-3xl">
                    The Injector is responsible for the "Magic". It prepends custom HTTP headers to the outgoing stream. 
                    This is typically done using a local proxy server that sits between the TUN interface and the SSH client.
                  </p>
                  <CodeBlock code={KOTLIN_INJECTOR} />
                  <div className="bg-orange-900/10 border border-orange-900/30 p-6 rounded-xl space-y-3">
                    <h4 className="text-sm font-mono font-bold text-orange-500 uppercase flex items-center gap-2">
                      <Info className="w-4 h-4" />
                      Common Payload Keywords
                    </h4>
                    <ul className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[10px] font-mono text-zinc-500">
                      <li className="flex flex-col gap-1"><span className="text-zinc-300">[host]</span> Target server address</li>
                      <li className="flex flex-col gap-1"><span className="text-zinc-300">[port]</span> Target server port</li>
                      <li className="flex flex-col gap-1"><span className="text-zinc-300">[crlf]</span> Carriage Return Line Feed</li>
                      <li className="flex flex-col gap-1"><span className="text-zinc-300">[ua]</span> User Agent string</li>
                    </ul>
                  </div>
                </section>
              )}

              {activeSection === 'tun2socks' && (
                <section className="space-y-6">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 rounded-xl bg-purple-600/20 flex items-center justify-center">
                      <Layers className="text-purple-500 w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-mono font-bold text-zinc-100 uppercase tracking-tighter">Tun2Socks Logic</h2>
                      <p className="text-zinc-500 text-sm font-mono uppercase tracking-widest">Layer 3 to Layer 4 Translation</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <p className="text-zinc-400 leading-relaxed">
                        The most complex part of the architecture. The TUN interface provides <span className="text-zinc-100">IP Packets</span> (Layer 3), 
                        but SSH and SOCKS proxies work with <span className="text-zinc-100">TCP/UDP Streams</span> (Layer 4).
                      </p>
                      <CodeBlock code={KOTLIN_TUN2SOCKS} language="cpp" />
                    </div>
                    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 flex flex-col items-center justify-center text-center space-y-4">
                      <div className="relative">
                        <div className="w-24 h-24 rounded-full border-4 border-dashed border-zinc-800 flex items-center justify-center">
                          <Layers className="w-10 h-10 text-zinc-700" />
                        </div>
                        <motion.div 
                          animate={{ rotate: 360 }}
                          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                          className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-orange-600/20 flex items-center justify-center border border-orange-600/50"
                        >
                          <Zap className="w-4 h-4 text-orange-500" />
                        </motion.div>
                      </div>
                      <h4 className="text-sm font-mono font-bold text-zinc-100 uppercase">Translation Engine</h4>
                      <p className="text-[10px] text-zinc-500 max-w-xs">Converting raw bytes into meaningful connections. The heart of any modern VPN client.</p>
                    </div>
                  </div>
                </section>
              )}

              {activeSection === 'ssh-tunnel' && (
                <section className="space-y-6">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center">
                      <Lock className="text-zinc-100 w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-mono font-bold text-zinc-100 uppercase tracking-tighter">SSH Tunneling</h2>
                      <p className="text-zinc-500 text-sm font-mono uppercase tracking-widest">Secure Encapsulation (Layer 4/5)</p>
                    </div>
                  </div>
                  <p className="text-zinc-400 leading-relaxed max-w-3xl">
                    SSH provides the encrypted transport layer. By using <span className="text-zinc-100">Dynamic Port Forwarding</span>, 
                    we create a local SOCKS proxy that Tun2Socks can use to route all system traffic.
                  </p>
                  <CodeBlock code={KOTLIN_SSH_TUNNEL} />
                  <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
                    <h4 className="text-xs font-mono font-bold text-zinc-100 uppercase mb-2">Key Library: JSch</h4>
                    <p className="text-xs text-zinc-500">A pure Java implementation of SSH2. It allows us to manage sessions, handle authentication, and set up port forwarding entirely in user-space.</p>
                  </div>
                </section>
              )}

              {activeSection === 'resilience' && (
                <section className="space-y-6">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 rounded-xl bg-red-600/20 flex items-center justify-center">
                      <Zap className="text-red-500 w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-mono font-bold text-zinc-100 uppercase tracking-tighter">Resilience & Reconnect</h2>
                      <p className="text-zinc-500 text-sm font-mono uppercase tracking-widest">Error Handling & Stability</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h3 className="text-lg font-mono font-bold text-zinc-100 uppercase">Auto-Reconnection</h3>
                      <p className="text-sm text-zinc-500 leading-relaxed">
                        Mobile networks are unstable. The app must detect connection drops and trigger a reconnection sequence. 
                        This is implemented using a supervised loop in the <code className="text-orange-400">VpnService</code>.
                      </p>
                      <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg space-y-2">
                        <h5 className="text-xs font-mono font-bold text-zinc-100 uppercase">Strategies:</h5>
                        <ul className="text-xs text-zinc-500 space-y-1 list-disc list-inside">
                          <li>Exponential Backoff (Wait 1s, 2s, 4s, 8s...)</li>
                          <li>Network State Listeners (ConnectivityManager)</li>
                          <li>Keep-Alive Packets (SSH Heartbeat)</li>
                        </ul>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h3 className="text-lg font-mono font-bold text-zinc-100 uppercase">Error Handling</h3>
                      <p className="text-sm text-zinc-500 leading-relaxed">
                        Network errors must be caught to prevent service crashes. 
                        We use structured <code className="text-orange-400">try-catch</code> blocks and detailed logging.
                      </p>
                      <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg space-y-2">
                        <h5 className="text-xs font-mono font-bold text-zinc-100 uppercase">Common Exceptions:</h5>
                        <ul className="text-xs text-zinc-500 space-y-1 list-disc list-inside">
                          <li><span className="text-zinc-300">IOException:</span> TUN interface failure</li>
                          <li><span className="text-zinc-300">JSchException:</span> SSH authentication/network error</li>
                          <li><span className="text-zinc-300">SocketException:</span> Connection reset by peer</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {activeSection === 'flow' && (
                <section className="space-y-8">
                  <div className="space-y-2">
                    <h2 className="text-3xl font-mono font-bold text-zinc-100 uppercase tracking-tighter">Data Flow Map</h2>
                    <p className="text-zinc-500 text-sm font-mono uppercase tracking-widest">The Journey of a Packet</p>
                  </div>
                  <FlowDiagram onStepClick={setActiveSection} />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
                      <span className="text-[10px] font-mono text-orange-500 uppercase tracking-widest">Phase 1</span>
                      <h4 className="text-sm font-mono font-bold text-zinc-100 uppercase">Interception</h4>
                      <p className="text-xs text-zinc-500 leading-relaxed">The OS routes traffic to the TUN interface. VpnService reads the raw bytes from the file descriptor.</p>
                    </div>
                    <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
                      <span className="text-[10px] font-mono text-blue-500 uppercase tracking-widest">Phase 2</span>
                      <h4 className="text-sm font-mono font-bold text-zinc-100 uppercase">Manipulation</h4>
                      <p className="text-xs text-zinc-500 leading-relaxed">Tun2Socks translates the packet. The Injector adds the spoofed HTTP headers to the TCP stream.</p>
                    </div>
                    <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
                      <span className="text-[10px] font-mono text-purple-500 uppercase tracking-widest">Phase 3</span>
                      <h4 className="text-sm font-mono font-bold text-zinc-100 uppercase">Encapsulation</h4>
                      <p className="text-xs text-zinc-500 leading-relaxed">The SSH client wraps the modified stream in an encrypted tunnel and sends it to the remote server.</p>
                    </div>
                  </div>
                </section>
              )}
              {activeSection === 'settings' && (
                <section className="space-y-8">
                  <div className="space-y-2">
                    <h2 className="text-3xl font-mono font-bold text-zinc-100 uppercase tracking-tighter">Global <span className="text-orange-500">Settings</span></h2>
                    <p className="text-zinc-500 text-sm font-mono uppercase tracking-widest">Advanced Configuration Simulation</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6">
                      <h3 className="text-sm font-mono font-bold text-zinc-100 uppercase flex items-center gap-2">
                        <Globe className="w-4 h-4 text-zinc-500" />
                        DNS Settings
                      </h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-zinc-400">Custom DNS</span>
                          <div className="w-10 h-5 bg-orange-600 rounded-full relative cursor-pointer">
                            <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-mono text-zinc-500 uppercase">Primary DNS</label>
                          <input type="text" defaultValue="8.8.8.8" className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono text-zinc-300" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-mono text-zinc-500 uppercase">Secondary DNS</label>
                          <input type="text" defaultValue="1.1.1.1" className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono text-zinc-300" />
                        </div>
                      </div>
                    </div>

                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6">
                      <h3 className="text-sm font-mono font-bold text-zinc-100 uppercase flex items-center gap-2">
                        <Activity className="w-4 h-4 text-zinc-500" />
                        UDP Forwarding
                      </h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-zinc-400">Enable UDPGW</span>
                          <div className="w-10 h-5 bg-zinc-800 rounded-full relative cursor-pointer">
                            <div className="absolute left-1 top-1 w-3 h-3 bg-zinc-500 rounded-full" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-mono text-zinc-500 uppercase">UDPGW Port</label>
                          <input type="text" defaultValue="7300" className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono text-zinc-300" />
                        </div>
                        <p className="text-[10px] text-zinc-500 leading-relaxed italic">
                          "UDP Gateway is required for gaming and VoIP traffic over SSH tunnels."
                        </p>
                      </div>
                    </div>

                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6">
                      <h3 className="text-sm font-mono font-bold text-zinc-100 uppercase flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-zinc-500" />
                        Hardware Acceleration
                      </h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-zinc-400">AES-NI Support</span>
                          <span className="text-[10px] font-mono text-green-500 uppercase">Detected</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-zinc-400">Buffer Size</span>
                          <select className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[10px] font-mono text-zinc-300">
                            <option>16 KB (Default)</option>
                            <option>32 KB</option>
                            <option>64 KB</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6">
                      <h3 className="text-sm font-mono font-bold text-zinc-100 uppercase flex items-center gap-2">
                        <Lock className="w-4 h-4 text-zinc-500" />
                        Security
                      </h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-zinc-400">Kill Switch</span>
                          <div className="w-10 h-5 bg-zinc-800 rounded-full relative cursor-pointer">
                            <div className="absolute left-1 top-1 w-3 h-3 bg-zinc-500 rounded-full" />
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-zinc-400">IPv6 Leak Protection</span>
                          <div className="w-10 h-5 bg-orange-600 rounded-full relative cursor-pointer">
                            <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <footer className="border-t border-zinc-800 py-8 px-6 bg-zinc-950">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">
            Strictly for Educational Purposes • NetTunnel Architect PoC v1.0
          </p>
          <div className="flex items-center gap-4">
            <button className="text-[10px] font-mono text-zinc-500 hover:text-zinc-100 transition-colors uppercase tracking-widest flex items-center gap-2">
              <ChevronRight className="w-3 h-3" />
              System Logs
            </button>
            <button className="text-[10px] font-mono text-zinc-500 hover:text-zinc-100 transition-colors uppercase tracking-widest flex items-center gap-2">
              <ChevronRight className="w-3 h-3" />
              Network Config
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
