/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Lock, ArrowRight, Sparkles } from 'lucide-react';

export default function App() {
  const [ra, setRa] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [timeLimits, setTimeLimits] = useState({ min: '40 minutos', max: '90 minutos' });

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: ra, senha: password })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setMessage({ type: 'success', text: 'Login bem sucedido!' });
        // Show time modal after successful login/entry
        setTimeout(() => setShowTimeModal(true), 1000);
        console.log('Auth Token:', data.auth_token);
      } else {
        setMessage({ type: 'error', text: data.error || 'Deu errado' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao conectar ao servidor.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-black overflow-hidden font-sans">
      {/* Time Limit Modal */}
      <AnimatePresence>
        {showTimeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-zinc-900 border border-blue-500/30 rounded-3xl p-8 max-w-sm w-full shadow-[0_0_50px_-12px_rgba(59,130,246,0.5)]"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mb-6 border border-blue-500/20">
                  <Sparkles className="w-8 h-8 text-blue-400" />
                </div>
                <h3 className="text-2xl font-display font-bold text-white mb-2">Prazos de Entrega</h3>
                <p className="text-gray-400 text-sm mb-8">Fique atento aos limites de tempo para sua redação astral.</p>
                
                <div className="grid grid-cols-2 gap-4 w-full mb-8">
                  <div className="bg-black/40 border border-white/5 p-4 rounded-2xl">
                    <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-1">Mínimo</p>
                    <p className="text-blue-400 font-display font-bold text-lg">{timeLimits.min}</p>
                  </div>
                  <div className="bg-black/40 border border-white/5 p-4 rounded-2xl">
                    <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-1">Máximo</p>
                    <p className="text-blue-400 font-display font-bold text-lg">{timeLimits.max}</p>
                  </div>
                </div>

                <button
                  onClick={() => setShowTimeModal(false)}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all active:scale-95 shadow-lg shadow-blue-600/20"
                >
                  Entendido
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Animated Background Elements */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/20 rounded-full blur-[120px] animate-astral" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[150px] animate-astral" style={{ animationDelay: '-5s' }} />
        
        {/* Stars/Particles */}
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0.2, scale: 0.5 }}
            animate={{ 
              opacity: [0.2, 0.8, 0.2],
              scale: [0.5, 1, 0.5],
            }}
            transition={{
              duration: Math.random() * 3 + 2,
              repeat: Infinity,
              delay: Math.random() * 5,
            }}
            className="absolute w-1 h-1 bg-blue-400 rounded-full"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
            }}
          />
        ))}
      </div>

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-md px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center p-3 mb-4 rounded-2xl bg-blue-600/10 border border-blue-500/20">
            <Sparkles className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-white mb-2">
            Redação SP <span className="text-blue-500">Astral</span>
          </h1>
          <p className="text-gray-400 font-light">Conecte-se ao seu universo de produtividade</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl"
        >
          <form onSubmit={handleLogin} className="space-y-6">
            <AnimatePresence mode="wait">
              {message && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className={`p-3 rounded-xl text-sm font-medium text-center ${
                    message.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                  }`}
                >
                  {message.text}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300 ml-1">RA (Registro Acadêmico)</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
                </div>
                <input
                  type="text"
                  value={ra}
                  onChange={(e) => setRa(e.target.value)}
                  className="block w-full pl-11 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                  placeholder="Ex: 123456789sp"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300 ml-1">Senha</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-11 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="relative w-full group overflow-hidden rounded-xl bg-blue-600 py-3.5 font-semibold text-white transition-all hover:bg-blue-500 active:scale-[0.98] disabled:opacity-70"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Entrar no Sistema
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400/0 via-white/20 to-blue-400/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            </button>
          </form>

        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-center mt-8 text-xs text-gray-600 uppercase tracking-widest font-medium"
        >
          Feito por bakai
        </motion.p>
      </div>
    </div>
  );
}
