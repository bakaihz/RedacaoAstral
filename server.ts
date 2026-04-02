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

  // Helper for official API calls
  const callOfficialApi = async (url: string, method: string, token: string, body?: any) => {
    const headers: any = {
      'accept': 'application/json',
      'content-type': 'application/json',
      'x-api-key': token,
      'x-api-platform': 'webclient',
      'x-api-realm': 'edusp',
      'origin': 'https://saladofuturo.educacao.sp.gov.br',
      'referer': 'https://saladofuturo.educacao.sp.gov.br/',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
    };

    const options: any = { method, headers };
    if (body) options.body = JSON.stringify(body);

    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[API Error] ${url} - ${response.status}: ${errorText}`);
        throw { status: response.status, message: errorText };
      }
      return response.json();
    } catch (error: any) {
      console.error(`[Fetch Failed] URL: ${url}`, error);
      if (error.cause) console.error(`[Fetch Cause]`, error.cause);
      throw error;
    }
  };

  // 1. Autenticação (Usando ip.tv como fallback para evitar bloqueios de datacenter)
  app.post("/api/login", async (req, res) => {
    const { user, senha } = req.body;
    console.log(`[Login] Tentativa de login para: ${user}`);

    if (!user || !senha) {
      return res.status(400).json({ error: "RA e senha são obrigatórios." });
    }

    try {
      // Usando edusp-api.ip.tv que é mais estável para acessos externos
      const loginResponse = await fetch('https://edusp-api.ip.tv/registration/edusp', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'origin': 'https://saladofuturo.educacao.sp.gov.br',
          'referer': 'https://saladofuturo.educacao.sp.gov.br/',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
          'x-api-platform': 'webclient',
          'x-api-realm': 'edusp'
        },
        body: JSON.stringify({
          realm: 'edusp',
          platform: 'webclient',
          id: user,
          password: senha
        })
      });

      if (!loginResponse.ok) {
        const errorText = await loginResponse.text();
        console.error(`[Login] Erro API: ${loginResponse.status} - ${errorText}`);
        const errorMsg = loginResponse.status === 401 ? "RA ou Senha incorretos." : `Erro no login: ${loginResponse.status}`;
        return res.status(loginResponse.status).json({ error: errorMsg });
      }

      const authData: any = await loginResponse.json();
      
      if (authData.auth_token) {
        console.log(`[Login] Sucesso para o usuário: ${user}`);
        return res.json({ 
          success: true, 
          auth_token: authData.auth_token,
          nick: authData.nick || user
        });
      } else {
        return res.status(401).json({ error: "Token não retornado pela plataforma." });
      }

    } catch (error: any) {
      console.error("[Login] Erro interno:", error);
      if (error.cause) console.error("[Login] Causa do erro:", error.cause);
      return res.status(500).json({ error: "Erro interno no servidor: " + error.message });
    }
  });

  // 0. Listagem de salas (Necessário para obter o publication_target)
  app.get("/api/rooms", async (req, res) => {
    const token = req.headers['x-api-key'] as string;
    if (!token) return res.status(401).json({ error: "Token ausente" });

    try {
      const data = await callOfficialApi('https://edusp-api.ip.tv/room/user?list_all=true&with_cards=true', 'GET', token);
      res.json(data);
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  // 1. Listagem de redações pendentes
  app.get("/api/redacoes/pending", async (req, res) => {
    const token = req.headers['x-api-key'] as string;
    const { publication_target } = req.query;
    if (!token) return res.status(401).json({ error: "Token ausente" });

    try {
      // Fallback para ip.tv se o oficial falhar
      const url = `https://edusp-api.ip.tv/tms/task/todo?publication_target=${publication_target}&limit=100&offset=0&is_essay=true&answer_statuses=pending&answer_statuses=draft`;
      const data = await callOfficialApi(url, 'GET', token);
      res.json(data);
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  // 2. Obter detalhes de uma redação
  app.get("/api/redacao/:taskId/detalhes", async (req, res) => {
    const token = req.headers['x-api-key'] as string;
    const { taskId } = req.params;
    const { room_name } = req.query;
    if (!token) return res.status(401).json({ error: "Token ausente" });

    try {
      const url = `https://edusp-api.ip.tv/tms/task/${taskId}/apply?preview_mode=false&room_name=${room_name}`;
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

  // 4. Salvar rascunho
  app.post("/api/salvar/rascunho", async (req, res) => {
    const { task_id, question_id, room_name, token_usuario, titulo, texto } = req.body;
    if (!token_usuario) return res.status(401).json({ error: "Token ausente" });

    try {
      const url = `https://edusp-api.ip.tv/tms/task/${task_id}/answer`;
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
