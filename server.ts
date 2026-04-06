import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  app.use((req, res, next) => {
    console.log(`[Server] Request: ${req.method} ${req.url}`);
    next();
  });

  // 0. Obter dados do usuário (Room User)
  app.get("/api/rooms", async (req, res) => {
    console.log("[API] Hit /api/rooms");
    const token = req.headers['x-api-key'] as string;
    if (!token) return res.status(401).json({ error: "Token ausente" });

    try {
      const data = await callOfficialApi('/room/user?list_all=true&with_cards=true', 'GET', token);
      res.json(data);
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  // Helper for official API calls
  const callOfficialApi = async (url: string, method: string, token: string, body?: any) => {
    const domains = [
      'https://edusp-api.ip.tv',
      'https://api.educacao.sp.gov.br',
      'https://shuziroastralhub.onrender.com'
    ];
    
    let lastError: any = null;
    
    for (const domain of domains) {
      const targetUrl = url.startsWith('http') ? url : `${domain}${url}`;
      
      const headers: any = {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'content-type': 'application/json',
        'sec-ch-ua': '"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'cross-site',
        'x-api-key': token,
        'x-api-platform': 'webclient',
        'x-api-realm': 'edusp',
        'origin': domain,
        'referer': `${domain}/`,
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
      };

      const options: any = { 
        method, 
        headers,
        signal: AbortSignal.timeout(20000) // Increased to 20s
      };
      if (body) options.body = JSON.stringify(body);

      try {
        console.log(`[API Request] ${method} ${targetUrl}`);
        const response = await fetch(targetUrl, options);
        
        const contentType = response.headers.get("content-type");
        console.log(`[API Response] ${targetUrl}: ${response.status} Content-Type: ${contentType}`);

        if (response.status === 403) {
          const text = await response.text();
          if (text.includes('cloudflare') || text.includes('challenge')) {
            console.warn(`[API Blocked] Cloudflare challenge detected on ${domain}`);
          }
          lastError = { status: 403, message: `Acesso bloqueado pela proteção anti-bot em ${domain}.` };
          continue;
        }

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[API Error Response] ${targetUrl}: ${response.status}`, errorText);
          throw { status: response.status, message: errorText };
        }
        
        const data = await response.json().catch(() => {
          console.error(`[API Error] Failed to parse JSON from ${targetUrl}`);
          throw { status: 500, message: "Resposta da API não é um JSON válido." };
        });
        console.log(`[API Success] ${targetUrl} returned ${Array.isArray(data) ? data.length + ' items' : 'an object'}`);
        return data;
      } catch (error: any) {
        const errorMsg = error.name === 'AbortError' ? 'Tempo limite de conexão excedido.' : (error.message || error);
        console.warn(`[API Attempt Failed] ${targetUrl}: ${errorMsg}`); // Changed to warn
        lastError = { status: 500, message: `Erro ao conectar ao domínio ${domain}: ${errorMsg}` };
        // Small delay before next attempt
        await new Promise(r => setTimeout(r, 800));
      }
    }
    
    throw lastError || new Error("Falha ao conectar às APIs.");
  };

  // 1. Autenticação
  app.post("/api/login", async (req, res) => {
    const { user, senha } = req.body;
    console.log(`[Login] Tentativa para: ${user} com senha: ${senha ? '***' : 'vazia'}`);

    if (!user || !senha) {
      return res.status(400).json({ error: "RA e senha são obrigatórios." });
    }

    const loginDomains = [
      'https://edusp-api.ip.tv/registration/edusp',
      'https://api.educacao.sp.gov.br/registration/edusp',
      'https://shuziroastralhub.onrender.com/registration/edusp'
    ];

    console.log(`[Login] Iniciando tentativa de login com ${loginDomains.length} domínios.`);
    let lastError: any = null;

    for (const url of loginDomains) {
      try {
        const domain = new URL(url).origin;
        console.log(`[Login Request] Iniciando fetch para: ${url}`);
        const loginResponse = await fetch(url, {
          method: 'POST',
          headers: {
            'accept': 'application/json, text/plain, */*',
            'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            'content-type': 'application/json',
            'sec-ch-ua': '"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'origin': domain,
            'referer': `${domain}/`,
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
            'x-api-platform': 'webclient',
            'x-api-realm': 'edusp'
          },
          body: JSON.stringify({
            realm: 'edusp',
            platform: 'webclient',
            id: user,
            password: senha
          }),
          signal: AbortSignal.timeout(20000) // Increased to 20s
        });

        if (loginResponse.status === 403) {
          const text = await loginResponse.text();
          console.warn(`[Login 403] Bloqueio detectado em ${url}`);
          lastError = { status: 403, error: `Acesso bloqueado pela proteção anti-bot em ${url}.` };
          continue;
        }

        if (!loginResponse.ok) {
          const errorText = await loginResponse.text();
          console.warn(`[Login Attempt Failed] ${url}: ${loginResponse.status} - Body: ${errorText}`);
          lastError = { status: loginResponse.status, error: loginResponse.status === 401 ? "RA ou Senha incorretos." : `Erro na plataforma oficial (${url}): ${loginResponse.status}` };
          if (loginResponse.status === 401) break;
          continue;
        }

        const authData: any = await loginResponse.json();
        if (authData.auth_token) {
          console.log(`[Login Success] ${user}`);
          return res.json({ 
            success: true, 
            auth_token: authData.auth_token,
            nick: authData.nick || user
          });
        }
      } catch (error: any) {
        const errorMsg = error.name === 'AbortError' ? 'Tempo limite de conexão excedido.' : (error.message || error);
        console.warn(`[Login Attempt Failed] ${url}:`, errorMsg);
        lastError = { status: 500, error: `Erro de conexão com a API (${url}): ${errorMsg}` };
        await new Promise(r => setTimeout(r, 800));
      }
    }

    return res.status(lastError?.status || 500).json({ error: lastError?.error || "Falha na autenticação (Bloqueio Anti-Bot)." });
  });

  // 1. Buscar tarefas de redação
  app.get("/api/tms/task/todo", async (req, res) => {
    const token = req.headers['x-api-key'] as string;
    const { publication_target } = req.query;
    if (!token) return res.status(401).json({ error: "Token ausente" });

    const targets = Array.isArray(publication_target) ? publication_target : [publication_target];
    
    try {
      let allTasks: any[] = [];
      
      for (const target of targets) {
        const url = `/tms/task/todo?publication_target=${encodeURIComponent(target as string)}&is_essay=true&with_answer=true&filter_expired=true&with_apply_moment=true&answer_statuses=draft&answer_statuses=pending`;
        console.log(`[API] Fetching essays for target: ${target}`);
        
        const rawData = await callOfficialApi(url, 'GET', token);
        const tasks = Array.isArray(rawData) ? rawData : (rawData.results || rawData.data || rawData.tasks || rawData.items || []);
        
        if (Array.isArray(tasks)) {
          allTasks.push(...tasks);
        }
      }
      
      res.json(allTasks);
    } catch (error: any) {
      console.error(`[API Error] Failed to fetch essays:`, error);
      res.status(error.status || 500).json({ error: error.message || "Erro interno" });
    }
  });

  // 2. Aplicar (abrir) uma redação específica
  app.get("/api/tms/task/:taskId/apply", async (req, res) => {
    const token = req.headers['x-api-key'] as string;
    const { taskId } = req.params;
    const { room_id } = req.query;
    if (!token) return res.status(401).json({ error: "Token ausente" });

    try {
      const url = `/tms/task/${taskId}/apply?preview_mode=false&token_code=null&room_name=${room_id}`;
      const data = await callOfficialApi(url, 'GET', token);
      res.json(data);
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  // 3. Buscar categorias/professores
  app.get("/api/tms/task/targets/categories", async (req, res) => {
    const token = req.headers['x-api-key'] as string;
    const { publication_target } = req.query;
    if (!token) return res.status(401).json({ error: "Token ausente" });

    try {
      const url = `/tms/task/targets/categories?category_parent_id=19&is_essay=true&is_exam=false&publication_target=${encodeURIComponent(publication_target as string)}`;
      const data = await callOfficialApi(url, 'GET', token);
      res.json(data);
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  // 3. Geração de redação por IA (OpenRouter)
  app.post("/api/gerar", async (req, res) => {
    const { genero, contexto } = req.body;

    if (!contexto) return res.status(400).json({ error: "Contexto ausente" });

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY || "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"}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "google/gemma-4-31b-it",
          messages: [
            {
              role: "user",
              content: `Você é um especialista em redação escolar. Escreva uma redação de alta qualidade.
              Gênero: ${genero || "Dissertativo-argumentativo"}
              Contexto/Tema: ${contexto}
              
              Responda EXCLUSIVAMENTE em formato JSON com as chaves "titulo" e "texto".`
            }
          ],
          response_format: { type: "json_object" }
        })
      });

      const data: any = await response.json();
      const content = data.choices[0]?.message?.content;
      const result = JSON.parse(content || "{}");
      res.json(result);
    } catch (error: any) {
      console.error("OpenRouter Error:", error);
      res.status(500).json({ error: "Erro na geração por IA" });
    }
  });

  // 4. Salvar rascunho (Legacy/Internal)
  app.post("/api/salvar/rascunho", async (req, res) => {
    const { task_id, question_id, room_name, token_usuario, titulo, texto } = req.body;
    if (!token_usuario) return res.status(401).json({ error: "Token ausente" });

    try {
      const url = `/tms/task/${task_id}/answer`;
      const payload = {
        room_for_apply: room_name,
        answers: [
          {
            question_id,
            essay_title: titulo,
            essay_text: texto
          }
        ]
      };
      const data = await callOfficialApi(url, 'POST', token_usuario, payload);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  // 5. Salvar rascunho (New/Complete) - Matches user request
  app.post("/api/complete", async (req, res) => {
    const { task_id, question_id, room_for_apply, auth_token, titulo, texto, answer_id } = req.body;
    if (!auth_token) return res.status(401).json({ error: "Token ausente" });

    try {
      const url = `/tms/task/${task_id}/answer`;
      const payload: any = {
        room_for_apply: room_for_apply,
        answers: [
          {
            question_id,
            essay_title: titulo,
            essay_text: texto
          }
        ]
      };
      
      // If answer_id exists, it's an update
      if (answer_id) {
        payload.answers[0].answer_id = answer_id;
      }

      const data = await callOfficialApi(url, 'POST', auth_token, payload);
      res.json({ success: true, data });
    } catch (error: any) {
      console.error(`[Complete Error] Task ${task_id}:`, error.message || error);
      res.status(error.status || 500).json({ error: error.message || "Erro ao salvar rascunho." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
