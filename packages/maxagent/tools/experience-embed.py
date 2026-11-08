"""Векторы для движка опыта (experience-engine.js): multilingual-e5-small, ONNX, без интернета.

Модель и библиотеки — в ~/.maxagent/vector/ (model/, py/). Вход — JSON на stdin:
  {"query": ["текст", ...]} или {"passage": ["текст", ...]}
Выход — JSON: {"vectors": [[...384 числа...], ...]} (нормированные; близость = скалярное произведение).
  python experience-embed.py --self-test   — замер скорости и пример близости
"""
import json
import os
import sys
import time

VEC = os.environ.get('MAXAGENT_VECTOR') or os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'vector')
sys.path.insert(0, os.path.join(VEC, 'py'))

import numpy as np  # noqa: E402
import onnxruntime as ort  # noqa: E402
from tokenizers import Tokenizer  # noqa: E402

MODEL = os.path.join(VEC, 'model')
MAX_TOKENS = 256


def load():
    tok = Tokenizer.from_file(os.path.join(MODEL, 'tokenizer.json'))
    tok.enable_truncation(MAX_TOKENS)
    tok.enable_padding()
    opts = ort.SessionOptions()
    opts.log_severity_level = 3
    sess = ort.InferenceSession(os.path.join(MODEL, 'model_quantized.onnx'), opts, providers=['CPUExecutionProvider'])
    return tok, sess


def embed(tok, sess, texts, kind):
    # e5: "query: " для вопроса, "passage: " для текста опыта.
    enc = tok.encode_batch([f'{kind}: {t}' for t in texts])
    ids = np.array([e.ids for e in enc], dtype=np.int64)
    mask = np.array([e.attention_mask for e in enc], dtype=np.int64)
    feed = {'input_ids': ids, 'attention_mask': mask}
    if 'token_type_ids' in [i.name for i in sess.get_inputs()]:
        feed['token_type_ids'] = np.zeros_like(ids)
    hidden = sess.run(None, feed)[0]
    m = mask[..., None].astype(np.float32)
    v = (hidden * m).sum(1) / np.clip(m.sum(1), 1e-9, None)
    v /= np.linalg.norm(v, axis=1, keepdims=True)
    return v


def serve(port, idle=3600):
    """Фоновый режим: модель загружена один раз, хук спрашивает по 127.0.0.1 (только этот ПК). Час без запросов — выход."""
    import threading
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
    tok, sess = load()
    lock = threading.Lock()
    last = [time.time()]

    class H(BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def do_POST(self):
            last[0] = time.time()
            try:
                req = json.loads(self.rfile.read(int(self.headers.get('Content-Length') or 0)).decode('utf-8') or '{}')
                kind = 'query' if 'query' in req else 'passage'
                texts = (req.get(kind) or [])[:256]
                with lock:
                    vecs = embed(tok, sess, texts, kind).round(5).tolist() if texts else []
                body = json.dumps({'vectors': vecs}).encode('utf-8')
                self.send_response(200)
            except Exception as e:  # плохой запрос не роняет процесс
                body = json.dumps({'error': str(e)[:200]}).encode('utf-8')
                self.send_response(400)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    srv = ThreadingHTTPServer(('127.0.0.1', port), H)

    def watchdog():
        while time.time() - last[0] < idle:
            time.sleep(30)
        srv.shutdown()
    threading.Thread(target=watchdog, daemon=True).start()
    srv.serve_forever()


def main():
    if '--serve' in sys.argv:
        serve(int(sys.argv[sys.argv.index('--serve') + 1]))
        return
    if '--self-test' in sys.argv:
        t0 = time.time()
        tok, sess = load()
        t1 = time.time()
        q = ['зайди на сервер', 'как посмотреть текст ролика', 'выполни команду в терминале']
        p = ['Подключиться к удалённому серверу по SSH', 'Получить субтитры YouTube-ролика через API',
             'Выполнить команду на этом ПК: Windows, PowerShell 5.1, Git Bash', 'Рецепт борща']
        qv = embed(tok, sess, q, 'query')
        pv = embed(tok, sess, p, 'passage')
        t2 = time.time()
        print(f'загрузка {t1 - t0:.2f} с, 7 текстов {t2 - t1:.2f} с')
        for i, s in enumerate(q):
            sims = pv @ qv[i]
            print(f'«{s}» → ' + ', '.join(f'{p[j][:28]}={sims[j]:.2f}' for j in np.argsort(-sims)))
        return
    req = json.loads(sys.stdin.buffer.read().decode('utf-8-sig') or '{}')
    kind = 'query' if 'query' in req else 'passage'
    texts = req.get(kind) or []
    if not texts:
        print('{"vectors": []}')
        return
    tok, sess = load()
    out = []
    for i in range(0, len(texts), 32):
        out.extend(embed(tok, sess, texts[i:i + 32], kind).round(5).tolist())
    sys.stdout.write(json.dumps({'vectors': out}))


if __name__ == '__main__':
    main()
