import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import jwt from 'jsonwebtoken'
import { initDb, listTasks, createTask, updateTask, SortField, SortOrder } from './db'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 4000
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret'

app.use(cors())
app.use(express.json())

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
	const auth = req.headers.authorization || ''
	const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
	try {
		jwt.verify(token, JWT_SECRET)
		next()
	} catch {
		res.status(401).json({ error: 'unauthorized' })
	}
}

app.get('/api/health', (_req, res) => {
	res.json({ ok: true })
})

app.post('/api/login', (req, res) => {
	const { username, password } = req.body as { username?: string; password?: string }
	if (username === 'admin' && password === '123') {
		const token = jwt.sign({ role: 'admin', username }, JWT_SECRET, { expiresIn: '12h' })
		return res.json({ token })
	}
	return res.status(401).json({ error: 'invalid_credentials' })
})

app.get('/api/tasks', async (req, res) => {
	try {
		const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1)
		const sort = (String(req.query.sort || 'username') as SortField)
		const order = (String(req.query.order || 'asc') as SortOrder)
		const data = await listTasks(page, sort, order)
		res.json(data)
	} catch (e) {
		res.status(500).json({ error: 'failed_to_list' })
	}
})

app.post('/api/tasks', async (req, res) => {
	try {
		const { username, email, text } = req.body as { username?: string; email?: string; text?: string }
		if (!username || !email || !text) {
			return res.status(400).json({ error: 'username_email_text_required' })
		}
		const created = await createTask({ username, email, text })
		res.status(201).json(created)
	} catch (e) {
		res.status(500).json({ error: 'failed_to_create' })
	}
})

app.patch('/api/tasks/:id', requireAuth, async (req, res) => {
	try {
		const id = Number(req.params.id)
		if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid_id' })
		const { text, completed } = req.body as { text?: string; completed?: boolean }

		const payload: { text?: string; completed?: boolean } = {}
		if (typeof text === 'string') payload.text = text
		if (typeof completed === 'boolean') payload.completed = completed

		const updated = await updateTask(id, payload)
		if (!updated) return res.status(404).json({ error: 'not_found' })
		res.json(updated)
	} catch (e) {
		res.status(500).json({ error: 'failed_to_update' })
	}
})

initDb()
	.then(() => {
		app.listen(PORT, () => {
			console.log(`API listening on http://localhost:${PORT}`)
		})
	})
	.catch((err) => {
		console.error('DB init failed', err)
		process.exit(1)
	})
