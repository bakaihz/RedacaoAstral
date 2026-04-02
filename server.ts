import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

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

    const response = await fetch(url, options);
    if (!response.ok) {
      const errorText = await response.text();
      throw { status: response.status, message: errorText };
    }
    return response.json();
  };

  // 1. Autenticação
  app.post("/api/login", async (req, res) => {
    const { user, senha } = req.body;

    if (!user || !senha) {
      return res.status(400).json({ error: "User e senha são obrigatórios." });
    }

    try {
      // Step 1: Login to SED
      const loginResponse = await fetch('https://sedintegracoes.educacao.sp.gov.br/credenciais/api/LoginCompletoToken', {
        method: 'POST',
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Content-Type': 'application/json',
          'Ocp-Apim-Subscription-Key': '2b03c1db3884488795f79c37c069381a',
          'Origin': 'https://saladofuturo.educacao.sp.gov.br',
          'Referer': 'https://saladofuturo.educacao.sp.gov.br/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
        },
        body: JSON.stringify({ user, senha })
      });

      if (!loginResponse.ok) {
        return res.status(loginResponse.status).json({ error: `Erro no login SED: ${loginResponse.status}` });
      }

      const loginData: any = await loginResponse.json();
      const token = loginData.token;

      if (!token) {
        return res.status(401).json({ error: "Token não retornado pelo SED." });
      }

      // Step 2: Get auth_token from EDUSP
      const authResponse = await fetch('https://edusp-api.ip.tv/registration/edusp/token', {
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
        body: JSON.stringify({ token: token })
      });

      if (!authResponse.ok) {
        return res.status(authResponse.status).json({ error: `Erro no auth EDUSP: ${authResponse.status}` });
      }

      const authData: any = await authResponse.json();
      
      if (authData.auth_token) {
        return res.json({ 
          success: true, 
          auth_token: authData.auth_token,
          nick: authData.nick || user,
          nr_telefone: loginData.DadosUsuario?.A?.[0]?.NR_TELEFONE || 'Não encontrado'
        });
      } else {
        return res.status(401).json({ error: "Auth token não retornado pelo EDUSP." });
      }

    } catch (error: any) {
      console.error("Login Proxy Error:", error);
      return res.status(500).json({ error: "Erro interno no servidor: " + error.message });
    }
  });

  // 2. Listagem de salas do usuário
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

  // 3. Listagem de redações pendentes
  app.get("/api/tasks/pending", async (req, res) => {
    const token = req.headers['x-api-key'] as string;
    const { publication_target } = req.query;
    if (!token) return res.status(401).json({ error: "Token ausente" });

    try {
      const url = `https://edusp-api.ip.tv/tms/task/todo?publication_target=${publication_target}&answer_statuses=pending&answer_statuses=draft`;
      const data = await callOfficialApi(url, 'GET', token);
      const essays = data.filter((task: any) => task.is_essay === true);
      res.json(essays);
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  // 4. Obter detalhes de uma redação
  app.get("/api/task/:taskId/apply", async (req, res) => {
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

  // 5. Geração de redação por IA (OpenRouter via Fetch)
  app.post("/api/generate-essay", async (req, res) => {
    const { genre, prompt } = req.body;

    if (!prompt) return res.status(400).json({ error: "Prompt ausente" });

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY || "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"}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://ais-dev-ljiwv337awfoq7gxcbm3ey-191985863863.us-west1.run.app", // Optional
          "X-Title": "Redação SP Astral" // Optional
        },
        body: JSON.stringify({
          model: "google/gemma-4-31b-it",
          messages: [
            {
              role: "user",
              content: `Você é um especialista em redação escolar. Escreva uma redação de alta qualidade sobre o tema abaixo.
              Gênero: ${genre || "Dissertativo-argumentativo"}
              Tema e Textos de Apoio: ${prompt}
              
              Responda EXCLUSIVAMENTE em formato JSON com as chaves "titulo" e "texto".`
            }
          ],
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Erro na API do OpenRouter");
      }

      const data: any = await response.json();
      const content = data.choices[0]?.message?.content;
      const result = JSON.parse(content || "{}");
      res.json({ success: true, response: result });
    } catch (error: any) {
      console.error("OpenRouter Generation Error:", error);
      res.status(500).json({ error: "Erro na geração por IA: " + error.message });
    }
  });

  // 6. Envio da redação como rascunho
  app.post("/api/complete", async (req, res) => {
    const { auth_token, task_id, titulo, texto, room_for_apply, question_id } = req.body;
    if (!auth_token) return res.status(401).json({ error: "Token ausente" });

    try {
      const url = `https://edusp-api.ip.tv/tms/task/${task_id}/answer`;
      const payload = {
        room_for_apply,
        answers: [
          {
            question_id,
            essay_title: titulo,
            essay_text: texto
          }
        ]
      };
      const data = await callOfficialApi(url, 'POST', auth_token, payload);
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
    const distPath = path.join(process.cwd(), 'dist');
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
