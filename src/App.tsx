import { useState, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Lock, ArrowRight, Sparkles, BookOpen, Clock, LogOut, ChevronRight, Save, Trash2, ExternalLink } from 'lucide-react';

// Custom Discord Icon SVG
const DiscordIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
);

export default function App() {
  const [ra, setRa] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [timeLimits, setTimeLimits] = useState({ min: '40', max: '90' });
  const [isEditingTime, setIsEditingTime] = useState(false);
  
  // Saved Accounts State
  const [savedAccounts, setSavedAccounts] = useState<{ra: string, pass: string}[]>([]);
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [showDiscordModal, setShowDiscordModal] = useState(false);
  
  // Auth & Data State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authToken, setAuthToken] = useState('');
  const [userNick, setUserNick] = useState('');
  const [rooms, setRooms] = useState<any[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  const [essays, setEssays] = useState<any[]>([]);
  const [isFetchingData, setIsFetchingData] = useState(false);

  // Writing View State
  const [selectedEssay, setSelectedEssay] = useState<any | null>(null);
  const [essayDetails, setEssayDetails] = useState<any | null>(null);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);
  const [generatedEssay, setGeneratedEssay] = useState<{titulo: string, texto: string} | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

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
        // Save account to localStorage
        try {
          const newAccount = { ra, pass: password };
          const existingRaw = localStorage.getItem('saved_accounts');
          let existing = [];
          if (existingRaw) {
            const parsed = JSON.parse(existingRaw);
            existing = Array.isArray(parsed) ? parsed : [];
          }
          
          const isDuplicate = existing.some((acc: any) => acc && acc.ra === ra);
          if (!isDuplicate) {
            const updated = [...existing, newAccount];
            localStorage.setItem('saved_accounts', JSON.stringify(updated));
            setSavedAccounts(updated);
          }
        } catch (e) {
          console.error('Error saving account to localStorage:', e);
        }

        setAuthToken(String(data.auth_token));
        setUserNick(String(data.nick || ra));
        setIsLoggedIn(true);
        setMessage({ type: 'success', text: 'Login bem sucedido!' });
        setTimeout(() => setShowTimeModal(true), 500);
      } else {
        setMessage({ type: 'error', text: data.error || 'RA ou Senha incorretos.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao conectar ao servidor.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem('saved_accounts');
      if (saved) {
        const parsed = JSON.parse(saved);
        setSavedAccounts(Array.isArray(parsed) ? parsed : []);
      }
    } catch (error) {
      console.error('Error loading saved accounts:', error);
      setSavedAccounts([]);
    }
  }, []);

  const removeAccount = (raToRemove: string) => {
    try {
      const updated = savedAccounts.filter(acc => acc && acc.ra !== raToRemove);
      localStorage.setItem('saved_accounts', JSON.stringify(updated));
      setSavedAccounts(updated);
    } catch (error) {
      console.error('Error removing account:', error);
    }
  };

  const fetchRooms = async () => {
    if (!authToken) return;
    try {
      const response = await fetch('/api/rooms', {
        headers: { 'x-api-key': authToken }
      });
      const data = await response.json();
      if (Array.isArray(data)) {
        setRooms(data);
        if (data.length > 0) {
          setSelectedRoom(data[0].name);
        }
      }
    } catch (error) {
      console.error('Error fetching rooms:', error);
    }
  };

  const fetchEssays = async (roomName: string) => {
    if (!authToken || !roomName) return;
    setIsFetchingData(true);
    try {
      const response = await fetch(`/api/redacoes/pending?publication_target=${encodeURIComponent(roomName)}`, {
        headers: { 'x-api-key': authToken }
      });
      const data = await response.json();
      if (Array.isArray(data)) {
        setEssays(data);
      }
    } catch (error) {
      console.error('Error fetching essays:', error);
    } finally {
      setIsFetchingData(false);
    }
  };

  const handleStartEssay = async (essay: any) => {
    setSelectedEssay(essay);
    setIsFetchingDetails(true);
    try {
      const response = await fetch(`/api/redacao/${essay.id}/detalhes?room_name=${encodeURIComponent(selectedRoom)}`, {
        headers: { 'x-api-key': authToken }
      });
      const data = await response.json();
      setEssayDetails(data);
    } catch (error) {
      console.error('Error fetching essay details:', error);
    } finally {
      setIsFetchingDetails(false);
    }
  };

  const handleGenerateEssay = async () => {
    if (!essayDetails) return;
    setIsGenerating(true);
    try {
      const context = `Enunciado: ${essayDetails.description}\n\nTextos Motivadores: ${essayDetails.essay_motivation_texts?.map((t: any) => t.text).join('\n')}`;
      const response = await fetch('/api/gerar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          genero: essayDetails.essay_genre_name,
          contexto: context
        })
      });
      const data = await response.json();
      setGeneratedEssay(data);
    } catch (error) {
      console.error('Error generating essay:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!selectedEssay || !essayDetails || !generatedEssay) return;
    setIsLoading(true);
    try {
      const response = await fetch('/api/salvar/rascunho', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: selectedEssay.id,
          question_id: essayDetails.questions?.[0]?.id,
          room_name: selectedRoom,
          token_usuario: authToken,
          titulo: generatedEssay.titulo,
          texto: generatedEssay.texto
        })
      });
      const data = await response.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Rascunho salvo com sucesso!' });
        setTimeout(() => {
          setSelectedEssay(null);
          setGeneratedEssay(null);
          setEssayDetails(null);
          fetchEssays(selectedRoom);
        }, 2000);
      }
    } catch (error) {
      console.error('Error saving draft:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn && authToken) {
      fetchRooms();
    }
  }, [isLoggedIn, authToken]);

  useEffect(() => {
    if (selectedRoom) {
      fetchEssays(selectedRoom);
    }
  }, [selectedRoom]);

  const handleLogout = () => {
    setIsLoggedIn(false);
    setAuthToken('');
    setEssays([]);
    setRooms([]);
    setSelectedRoom('');
    setSelectedEssay(null);
  };

  if (isLoggedIn) {
    return (
      <div className="relative min-h-screen w-full bg-black overflow-x-hidden font-sans text-white">
        {/* Time Limit Modal */}
        <AnimatePresence mode="wait">
          {showTimeModal && (
            <div key="time-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/80 backdrop-blur-sm">
              <motion.div
                key="time-modal-content"
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
                      <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-1">Mínimo (min)</p>
                      <input 
                        type="number" 
                        value={timeLimits.min}
                        onChange={(e) => setTimeLimits({...timeLimits, min: e.target.value})}
                        className="bg-transparent text-blue-400 font-display font-bold text-lg w-full text-center focus:outline-none"
                      />
                    </div>
                    <div className="bg-black/40 border border-white/5 p-4 rounded-2xl">
                      <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-1">Máximo (min)</p>
                      <input 
                        type="number" 
                        value={timeLimits.max}
                        onChange={(e) => setTimeLimits({...timeLimits, max: e.target.value})}
                        className="bg-transparent text-blue-400 font-display font-bold text-lg w-full text-center focus:outline-none"
                      />
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

        {/* Header */}
        <header className="relative z-10 border-b border-white/10 bg-black/50 backdrop-blur-md sticky top-0">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600/20 rounded-lg border border-blue-500/20">
                <Sparkles className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">Redação SP <span className="text-blue-500">Astral</span></h1>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Olá, {userNick}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selectedEssay && (
                <button 
                  onClick={() => {setSelectedEssay(null); setGeneratedEssay(null); setEssayDetails(null);}}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold transition-all border border-white/10"
                >
                  Voltar
                </button>
              )}
              <button 
                onClick={handleLogout}
                className="p-2 hover:bg-white/5 rounded-full transition-colors text-gray-400 hover:text-white"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        <main className="relative z-10 max-w-5xl mx-auto px-6 py-8">
          {selectedEssay ? (
            <div className="space-y-6">
              {/* Writing View */}
              <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2">{selectedEssay.title}</h2>
                    <div className="flex gap-3">
                      <span className="text-xs bg-blue-600/20 text-blue-400 px-2 py-1 rounded border border-blue-500/20 font-bold">
                        {essayDetails?.essay_genre_name || 'Carregando...'}
                      </span>
                      <span className="text-xs bg-white/5 text-gray-400 px-2 py-1 rounded border border-white/10 font-bold">
                        {essayDetails?.min_words || 0} - {essayDetails?.max_words || 0} palavras
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={handleGenerateEssay}
                    disabled={isGenerating || isFetchingDetails}
                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-600/20"
                  >
                    {isGenerating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Gerar com IA
                  </button>
                </div>

                {isFetchingDetails ? (
                  <div className="py-20 flex flex-col items-center justify-center text-gray-500 gap-4">
                    <div className="w-8 h-8 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
                    <p className="text-sm">Buscando detalhes da redação...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Instructions/Motivation */}
                    <div className="space-y-6">
                      <div className="bg-black/40 border border-white/5 rounded-2xl p-6">
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Enunciado</h4>
                        <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                          {essayDetails?.description}
                        </div>
                      </div>
                      <div className="bg-black/40 border border-white/5 rounded-2xl p-6">
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Textos Motivadores</h4>
                        <div className="space-y-4">
                          {essayDetails?.essay_motivation_texts?.map((text: any, idx: number) => (
                            <div key={idx} className="text-xs text-gray-400 leading-relaxed italic border-l-2 border-blue-500/30 pl-4">
                              {text.text}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Editor/Result */}
                    <div className="space-y-6">
                      {generatedEssay ? (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="bg-white/5 border border-blue-500/30 rounded-2xl p-6 space-y-4"
                        >
                          <h4 className="text-xs font-bold text-blue-400 uppercase tracking-widest">Resultado da IA</h4>
                          <input 
                            value={generatedEssay.titulo}
                            onChange={(e) => setGeneratedEssay({...generatedEssay, titulo: e.target.value})}
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-lg font-bold text-white focus:outline-none focus:border-blue-500"
                            placeholder="Título da Redação"
                          />
                          <textarea 
                            value={generatedEssay.texto}
                            onChange={(e) => setGeneratedEssay({...generatedEssay, texto: e.target.value})}
                            className="w-full h-[400px] bg-black/40 border border-white/10 rounded-xl p-4 text-sm text-gray-300 leading-relaxed focus:outline-none focus:border-blue-500 resize-none"
                            placeholder="Texto da Redação"
                          />
                          <button 
                            onClick={handleSaveDraft}
                            disabled={isLoading}
                            className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white py-4 rounded-xl font-bold transition-all shadow-lg shadow-green-600/20 flex items-center justify-center gap-2"
                          >
                            {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Salvar como Rascunho'}
                          </button>
                        </motion.div>
                      ) : (
                        <div className="h-full min-h-[400px] border-2 border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center text-center p-8 text-gray-600">
                          <Sparkles className="w-12 h-12 mb-4 opacity-20" />
                          <p className="text-sm">Clique em "Gerar com IA" para criar sua redação astral automaticamente.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Time Limits Banner */}
              <div className="mb-8 bg-gradient-to-r from-blue-900/20 to-transparent border border-blue-500/20 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h2 className="text-xl font-bold mb-1 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-400" />
                    Prazos de Entrega
                  </h2>
                  <p className="text-sm text-gray-400">Mantenha o equilíbrio entre o tempo e a qualidade astral.</p>
                </div>
                <div className="flex gap-4">
                  <div className="bg-black/40 border border-white/5 px-6 py-3 rounded-2xl group relative">
                    <p className="text-[9px] uppercase tracking-widest text-gray-500 font-bold mb-0.5">Mínimo</p>
                    <div className="flex items-center gap-1">
                      <input 
                        type="number"
                        value={timeLimits.min}
                        onChange={(e) => setTimeLimits({...timeLimits, min: e.target.value})}
                        className="bg-transparent text-blue-400 font-bold w-12 focus:outline-none"
                      />
                      <span className="text-xs text-gray-600">min</span>
                    </div>
                  </div>
                  <div className="bg-black/40 border border-white/5 px-6 py-3 rounded-2xl group relative">
                    <p className="text-[9px] uppercase tracking-widest text-gray-500 font-bold mb-0.5">Máximo</p>
                    <div className="flex items-center gap-1">
                      <input 
                        type="number"
                        value={timeLimits.max}
                        onChange={(e) => setTimeLimits({...timeLimits, max: e.target.value})}
                        className="bg-transparent text-blue-400 font-bold w-12 focus:outline-none"
                      />
                      <span className="text-xs text-gray-600">min</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Room Selection */}
              <div className="mb-8">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 block ml-1">Sua Sala Astral</label>
                <div className="flex flex-wrap gap-2">
                  {Array.isArray(rooms) && rooms.map((room) => room && (
                    <button
                      key={room.id}
                      onClick={() => setSelectedRoom(room.name)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                        selectedRoom === room.name 
                          ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20' 
                          : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      {String(room.name)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Essays List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-blue-400" />
                    Redações Pendentes
                  </h2>
                  <span className="text-xs bg-blue-600/20 text-blue-400 px-2 py-1 rounded-md border border-blue-500/20 font-bold">
                    {essays.length} Encontradas
                  </span>
                </div>

                {isFetchingData ? (
                  <div className="py-20 flex flex-col items-center justify-center text-gray-500 gap-4">
                    <div className="w-8 h-8 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
                    <p className="text-sm animate-pulse">Sincronizando com o universo...</p>
                  </div>
                ) : (Array.isArray(essays) && essays.length > 0) ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {essays.map((essay) => essay && (
                      <motion.div
                        key={essay.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-blue-500/30 transition-all group"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1 pr-4">
                            <h3 className="font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-2 mb-1">
                              {String(essay.title)}
                            </h3>
                            <p className="text-xs text-gray-500">ID: {String(essay.id)}</p>
                          </div>
                          <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                            essay.answer_status === 'draft' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/20' : 'bg-blue-500/20 text-blue-400 border border-blue-500/20'
                          }`}>
                            {essay.answer_status === 'draft' ? 'Rascunho' : 'Pendente'}
                          </div>
                        </div>
                        
                        <button 
                          onClick={() => handleStartEssay(essay)}
                          className="w-full bg-white/5 hover:bg-blue-600 border border-white/10 hover:border-blue-500 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 group/btn"
                        >
                          Fazer Redação
                          <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white/5 border border-dashed border-white/10 rounded-3xl py-20 flex flex-col items-center justify-center text-center px-6">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                      <BookOpen className="w-8 h-8 text-gray-600" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-300 mb-1">Nenhuma redação pendente</h3>
                    <p className="text-sm text-gray-500 max-w-xs">Seu universo acadêmico está em harmonia. Nenhuma tarefa encontrada para esta sala.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </main>

        {/* Background Effects */}
        <div className="fixed inset-0 z-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[40%] h-[40%] bg-blue-900/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 left-0 w-[50%] h-[50%] bg-blue-600/5 rounded-full blur-[150px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-black overflow-hidden font-sans">
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
        {/* Discord Button */}
        <div className="absolute top-0 right-6 md:-right-12">
          <button 
            onClick={() => setShowDiscordModal(true)}
            className="p-3 bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 rounded-full text-indigo-400 transition-all hover:scale-110 active:scale-95 shadow-lg shadow-indigo-600/10"
          >
            <DiscordIcon className="w-6 h-6" />
          </button>
        </div>

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
                  key={message.text}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className={`p-3 rounded-xl text-sm font-medium text-center ${
                    message.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                  }`}
                >
                  {String(message.text)}
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
                  placeholder="Seu RA (ex: 123456789sp)"
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

            {savedAccounts.length > 0 && (
              <button
                type="button"
                onClick={() => setShowSavedModal(true)}
                className="w-full py-2 text-xs font-bold text-gray-500 hover:text-blue-400 transition-colors flex items-center justify-center gap-2 uppercase tracking-widest"
              >
                <Save className="w-3.5 h-3.5" />
                Contas Salvas
              </button>
            )}
          </form>
        </motion.div>

        {/* Saved Accounts Modal */}
        <AnimatePresence mode="wait">
          {showSavedModal && (
            <div key="saved-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/80 backdrop-blur-sm">
              <motion.div
                key="saved-modal-content"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-zinc-900 border border-white/10 rounded-3xl p-6 max-w-sm w-full shadow-2xl"
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Save className="w-5 h-5 text-blue-400" />
                    Contas Salvas
                  </h3>
                  <button onClick={() => setShowSavedModal(false)} className="text-gray-500 hover:text-white">
                    <ArrowRight className="w-5 h-5 rotate-180" />
                  </button>
                </div>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {Array.isArray(savedAccounts) && savedAccounts.map((acc, idx) => acc && (
                    <div key={idx} className="flex items-center gap-2 group">
                      <button
                        onClick={() => {
                          setRa(acc.ra || '');
                          setPassword(acc.pass || '');
                          setShowSavedModal(false);
                        }}
                        className="flex-1 flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl transition-all text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400 font-bold text-xs">
                            {(String(acc.ra || '??')).substring(0, 2).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium text-gray-300">{String(acc.ra)}</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-blue-400 transition-colors" />
                      </button>
                      <button 
                        onClick={() => removeAccount(acc.ra)}
                        className="p-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-2xl border border-red-500/20 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Discord Modal */}
        <AnimatePresence mode="wait">
          {showDiscordModal && (
            <div key="discord-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/80 backdrop-blur-sm">
              <motion.div
                key="discord-modal-content"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-zinc-900 border border-indigo-500/30 rounded-3xl p-8 max-w-sm w-full text-center shadow-[0_0_50px_-12px_rgba(99,102,241,0.5)]"
              >
                <div className="w-20 h-20 bg-indigo-600/20 rounded-full flex items-center justify-center mb-6 mx-auto border border-indigo-500/20">
                  <DiscordIcon className="w-10 h-10 text-indigo-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Comunidade Astral</h3>
                <p className="text-gray-400 text-sm mb-8 leading-relaxed">
                  Junte-se ao nosso servidor no Discord para suporte, novidades e dicas astrais.
                </p>
                <div className="flex flex-col gap-3">
                  <a
                    href="https://discord.gg/jcHYPNMGX"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-indigo-600 hover:bg-indigo-50 text-indigo-600 hover:text-indigo-600 font-bold py-4 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
                    style={{ backgroundColor: '#5865F2', color: 'white' }}
                  >
                    Entrar no Servidor
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => setShowDiscordModal(false)}
                    className="w-full py-3 text-sm font-bold text-gray-500 hover:text-white transition-colors"
                  >
                    Fechar
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

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
