import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import https from "https";
import { OpenRouter } from "@openrouter/sdk";

// -- Imports do Bypass Antibot --
import { fetch as undiciFetch, Agent } from "undici";
import { CookieJar } from "tough-cookie";
import { JSDOM } from "jsdom";
import got from "got";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  console.log("[Server] Starting server...");
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
      console.log(`[API /rooms] First room object preview:`, JSON.stringify(Array.isArray(data) ? data[0] : (data.rooms ? data.rooms[0] : data)).substring(0, 150));
      res.json(data);
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  // Helper para construir a URL usando o TUNNEL_URL
  const buildProxyUrl = (targetUrl: string) => {
    const tunnelUrl = process.env.TUNNEL_URL || "https://cloud-tunnel.davilucas99kk.workers.dev/?url=";
    return `${tunnelUrl}${encodeURIComponent(targetUrl)}`;
  };

  // Helper for official API calls
  const callOfficialApi = async (url: string, method: string, token: string, body?: any) => {
    const domains = [
      'https://edusp-api.ip.tv',
      'https://api.educacao.sp.gov.br'
    ];
    
    let lastError: any = null;
    
    for (const domain of domains) {
      const targetUrl = url.startsWith('http') ? url : `${domain}${url}`;
      const finalRequestUrl = buildProxyUrl(targetUrl);
      
      const headers: any = {
        'accept': 'application/json, text/plain, */*',
        'content-type': 'application/json',
        'x-api-key': token,
        'x-api-platform': 'webclient',
        'x-api-realm': 'edusp',
        'origin': domain,
        'referer': `${domain}/`,
        'user-agent': 'Dalvik/2.1.0 (Linux; U; Android 11; SM-G991B Build/RP1A.200720.012)'
      };

      const options: any = { 
        method, 
        headers,
        signal: AbortSignal.timeout(20000) // Increased to 20s
      };
      if (body) options.body = JSON.stringify(body);

      try {
        console.log(`[API Request] ${method} ${finalRequestUrl}`);
        const response = await undiciFetch(finalRequestUrl, options);

        
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
          if (response.status === 401 || response.status === 403 || response.status === 400) {
            throw { status: response.status, message: errorText, isAuthError: true };
          }
          throw { status: response.status, message: errorText };
        }
        
        const data = await response.json().catch(() => {
          console.error(`[API Error] Failed to parse JSON from ${targetUrl}`);
          throw { status: 500, message: "Resposta da API não é um JSON válido." };
        });
        console.log(`[API Success] ${targetUrl} returned ${Array.isArray(data) ? data.length + ' items' : 'an object'}`);
        return data;
      } catch (error: any) {
        if (error.isAuthError) {
          throw error; // instantly fail, don't try other domains
        }
        const errorMsg = error.name === 'AbortError' ? 'Tempo limite de conexão excedido.' : (error.message || error);
        console.warn(`[API Attempt Failed] ${targetUrl}: ${errorMsg}`); // Changed to warn
        lastError = { status: 500, message: `Erro ao conectar ao domínio ${domain}: ${errorMsg}` };
        // Small delay before next attempt
        await new Promise(r => setTimeout(r, 800));
      }
    }
    
    throw lastError || new Error("Falha ao conectar às APIs.");
  };

  // 1. Autenticação (Proxy Bypass JSDOM + Got)
  app.post("/api/login", async (req, res) => {
    console.log(`[Server] Rota /api/login acessada! Iniciando Bypass...`);
    const { user, senha } = req.body;
    console.log(`[Login] Tentativa para: ${user}`);

    if (!user || !senha) {
      return res.status(400).json({ error: "RA e senha são obrigatórios." });
    }

    try {
      // Cria instâncias limpas por requisição para evitar vazamento de sessão entre alunos
      const cookieJar = new CookieJar();
      const agent = new Agent({
        keepAliveTimeout: 60_000,
        keepAliveMaxTimeout: 60_000
      });

      const fetchWithCookies = async (url: string | URL, options: any = {}) => {
        const urlStr = url.toString();
        const requestUrl = buildProxyUrl(urlStr);
        const cookieString = await cookieJar.getCookieString(urlStr);

        const res = await undiciFetch(requestUrl, {
          ...options,
          headers: {
            ...(options.headers || {}),
            cookie: cookieString
          },
          dispatcher: agent
        });

        // O pacote undici retorna arrays de set-cookie
        // Usa interface Headers do DOM real para obter.
        const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
        for (const setCookie of setCookies) {
          await cookieJar.setCookie(setCookie, urlStr);
        }

        return res;
      };

      // ==== PASSO 1: Obter Token Inicial do Salado Futuro ====
      console.log(`[Login] Passo 1: Autenticando com Token Completo...`);
      const step1TargetUrl = "https://sedintegracoes.educacao.sp.gov.br/saladofuturobffapi/credenciais/api/LoginCompletoToken";
      const step1RequestUrl = buildProxyUrl(step1TargetUrl);

      const step1Response = await undiciFetch(
        step1RequestUrl,
        {
          method: "POST",
          headers: {
            "accept": "application/json, text/plain, */*",
            "content-type": "application/json",
            "ocp-apim-subscription-key": "d701a2043aa24d7ebb37e9adf60d043b", // Usando a chave exata do seu script
            "referer": "https://saladofuturo.educacao.sp.gov.br/",
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36"
          },
          body: JSON.stringify({
            user: user,
            senha: senha
          }),
          dispatcher: agent
        }
      );

      if (!step1Response.ok) {
        const text = await step1Response.text();
        console.error(`[Login Erro Passo 1] (${step1Response.status}): ${text}`);
        
        let errorMsg = `RA ou Senha incorretos ou Bloqueio. (${step1Response.status})`;
        try {
          const parsed = JSON.parse(text);
          if (parsed.statusRetorno) {
            errorMsg = parsed.statusRetorno;
          }
        } catch(e) {}

        return res.status(step1Response.status === 401 ? 401 : step1Response.status).json({ 
          error: errorMsg
        });
      }

      const loginData = await step1Response.json() as any;
      const initialToken = loginData.token || loginData.access_token;
      console.log(`[Login] Passo 1 concluído, token inicial capturado.`);

      // ==== PASSO 2: Simular Navegador com JSDOM e Got ====
      console.log(`[Login] Passo 2: Inicializando simulador AntiBot (JSDOM)...`);
      const step2TargetUrl = "https://saladofuturo.educacao.sp.gov.br/login";
      const step2RequestUrl = buildProxyUrl(step2TargetUrl);

      const gotResponse = await got(step2RequestUrl, {
        throwHttpErrors: false,
        http2: false,
        headers: {
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
          "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8",
          "accept-encoding": "gzip, deflate, br",
          "referer": "https://saladofuturo.educacao.sp.gov.br/",
          "sec-ch-ua": '"Chromium";v="144", "Google Chrome";v="144", "Not(A:Brand";v="99"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"Windows"',
          "upgrade-insecure-requests": "1",
          "connection": "keep-alive",
          "pragma": "no-cache",
          "cache-control": "no-cache"
        }
      });

      // Capturando os cookies iniciais recebidos no HTML da página de proteção
      const cookiesHeaders = gotResponse.headers['set-cookie'];
      if (cookiesHeaders) {
         for (const cook of cookiesHeaders) {
            await cookieJar.setCookie(cook, "https://saladofuturo.educacao.sp.gov.br/");
            await cookieJar.setCookie(cook, "https://edusp-api.ip.tv/");
         }
      }

      const userAgentString = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36";

      const dom = new JSDOM(gotResponse.body as string, {
        url: "https://saladofuturo.educacao.sp.gov.br/",
        runScripts: "outside-only",
        pretendToBeVisual: true,
        userAgent: userAgentString
      } as any);

      const win: any = dom.window;
      win.fetch = fetchWithCookies; // Injeta o fetch protegido por cookies!

      console.log(`[Login] Passo 3: Obtendo auth_token oficial da Edusp...`);
      
      const eduspDomains = [
        "https://edusp-api.ip.tv",
        "https://api.educacao.sp.gov.br"
      ];
      
      let lastLoginErrorText = "";
      let step2Data = null;
      let successDomain = "";

      for (const domain of eduspDomains) {
        console.log(`[Login] Tentando obter token em: ${domain}`);
        try {
          const vsfApi = await win.fetch(`${domain}/registration/edusp/token`, {
            method: "POST",
            headers: {
              "accept": "application/json",
              "content-type": "application/json",
              "request-id": "|625bd2809ec74cc5bf522f4837291586.34b5d944b713472b",
              "sec-ch-ua": "\"Not(A:Brand\";v=\"8\", \"Chromium\";v=\"144\", \"Google Chrome\";v=\"144\"",
              "sec-ch-ua-mobile": "?0",
              "sec-ch-ua-platform": "\"Windows\"",
              "traceparent": "00-625bd2809ec74cc5bf522f4837291586-34b5d944b713472b-01",
              "x-api-platform": "webclient",
              "x-api-realm": "edusp",
              "user-agent": "Dalvik/2.1.0 (Linux; U; Android 11; SM-G991B Build/RP1A.200720.012)",
              "origin": "https://saladofuturo.educacao.sp.gov.br",
              "referer": "https://saladofuturo.educacao.sp.gov.br/"
            },
            body: JSON.stringify({
              token: initialToken
            })
          });

          if (vsfApi.ok) {
            step2Data = await vsfApi.json();
            successDomain = domain;
            break;
          } else {
            lastLoginErrorText = await vsfApi.text();
            console.warn(`[Login] Falha no domínio ${domain}: ${vsfApi.status}`);
          }
        } catch (err: any) {
          console.warn(`[Login] Falha de rede no domínio ${domain}: ${err.message}`);
          lastLoginErrorText = `Erro de rede: ${err.message}`;
        }
      }

      if (!step2Data) {
        console.warn(`[Login] Erro ao obter Token Edusp em todos os domínios. Último erro: ${lastLoginErrorText.substring(0, 500)}`);
        console.log(`[Login] Fallback: Utilizando o primeiro token capturado (CMSP).`);
        return res.json({ 
          success: true, 
          auth_token: initialToken,
          nick: user
        });
      }

      console.log(`[Login] Operação Phantom Proxy finalizada com Sucesso! (Usando ${successDomain})`);

      return res.json({ 
        success: true, 
        auth_token: step2Data.auth_token,
        nick: step2Data.nick || user
      });

    } catch (error: any) {
      console.error(`[Login] Erro crítico no bypass:`, error);
      return res.status(500).json({ error: `Erro interno no login: ${error.message}` });
    }
  });

  // 1. Buscar tarefas de redação
  app.get("/api/tms/task/todo", async (req, res) => {
    const token = req.headers['x-api-key'] as string;
    if (!token) return res.status(401).json({ error: "Token ausente" });

    try {
      // Repassar exatamente a string de query que o frontend montou
      const queryString = req.url.split('?')[1] || '';
      
      const officialUrl = `/tms/task/todo?expired_only=false&limit=100&offset=0&filter_expired=true&is_exam=false&with_answer=true&is_essay=true&answer_statuses=draft&answer_statuses=pending&with_apply_moment=true&${queryString}`;
      console.log(`[API] Fetching essays with mega-query...`);
      
      const rawData = await callOfficialApi(officialUrl, 'GET', token);
      const tasks = Array.isArray(rawData) ? rawData : (rawData.results || rawData.data || rawData.tasks || rawData.items || []);
      
      console.log(`[API /todo] Returned ${tasks.length ? tasks.length : 0} tasks total.`);
      
      if (Array.isArray(tasks) && tasks.length === 0) {
         console.log(`[API /todo] WARNING! zero tasks for this mega query. Confirme se há redações pendentes.`);
      }

      res.json(tasks);
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
      const apiKey = (process.env.OPENROUTER_API_KEY || "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").trim();
      console.log(`[OpenRouter] Call starting. Key: ${apiKey.substring(0, 10)}...`);

      const openrouter = new OpenRouter({
        apiKey: apiKey
      });

      const response = await openrouter.chat.send({
        httpReferer: 'https://saladofuturo.educacao.sp.gov.br/',
        appTitle: 'Astral SP',
        chatRequest: {
          model: "google/gemma-3-27b-it:free",
          messages: [
            {
              role: "user",
              content: `Você é um especialista em redação escolar. Escreva uma redação de alta qualidade.
            Gênero: ${genero || "Dissertativo-argumentativo"}
            Contexto/Tema: ${contexto}
            
            Responda EXCLUSIVAMENTE em formato JSON com as chaves "titulo" e "texto". Não inclua markdown como \`\`\`json ou qualquer outro texto.`
            }
          ]
        }
      });

      if (!response.choices || response.choices.length === 0) {
        throw new Error("Nenhuma resposta da IA recebida.");
      }

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("Conteúdo vazio da IA.");
      }

      let result;
      try {
        result = JSON.parse(content.replace(/```json/g, '').replace(/```/g, '').trim());
      } catch (e) {
        console.error("[JSON Parse Error] Content:", content);
        throw new Error("Falha ao formatar resposta da IA.");
      }
      
      res.json(result);
    } catch (error: any) {
      console.error("OpenRouter Error:", error.message || error);
      res.status(500).json({ error: error.message });
    }
  });

  // 4. Salvar rascunho (Legacy/Internal)
  app.post("/api/salvar/rascunho", async (req, res) => {
    const { task_id, question_id, room_name, token_usuario, titulo, texto } = req.body;
    if (!token_usuario) return res.status(401).json({ error: "Token ausente" });

    try {
      const url = `/tms/task/${task_id}/answer`;
      
      const payload: any = {
        room_for_apply: room_name,
        accessed_on: req.body.apply_moment || new Date(Date.now() - 5*60000).toISOString(),
        executed_on: new Date().toISOString(),
        answers: {
          [String(question_id)]: {
            question_id: question_id,
            question_type: "essay",
            title: titulo, // Try 'title' instead of 'essay_title'
            text: texto // Try 'text' instead of 'essay_text'
          }
        }
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
      const qIdStr = String(question_id);
      
      const payload: any = {
        room_for_apply: room_for_apply,
        accessed_on: req.body.apply_moment || new Date(Date.now() - 5*60000).toISOString(),
        executed_on: new Date().toISOString(),
        answers: {
          [qIdStr]: {
            question_id: parseInt(qIdStr),
            question_type: "essay",
            title: titulo, // Try 'title' instead of 'essay_title'
            text: texto // Try 'text' instead of 'essay_text'
          }
        }
      };
      
      if (answer_id) {
        payload.answers[qIdStr].answer_id = answer_id;
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
