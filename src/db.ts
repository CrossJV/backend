import sqlite3 from 'sqlite3'

export type SortField = 'username' | 'email' | 'status'
export type SortOrder = 'asc' | 'desc'

export interface TaskRow {
	id: number
	username: string
	email: string
	text: string
	completed: number
	edited_by_admin: number
	created_at: string
}

export interface CreateTaskInput {
	username: string
	email: string
	text: string
}

export interface UpdateTaskInput {
	text?: string
	completed?: boolean
}

sqlite3.verbose()

export const db = new sqlite3.Database('data.sqlite')

export function initDb(): Promise<void> {
	return new Promise((resolve, reject) => {
		db.serialize(() => {
			db.run(
				`CREATE TABLE IF NOT EXISTS tasks (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					username TEXT NOT NULL,
					email TEXT NOT NULL,
					text TEXT NOT NULL,
					completed INTEGER NOT NULL DEFAULT 0,
					edited_by_admin INTEGER NOT NULL DEFAULT 0,
					created_at TEXT NOT NULL DEFAULT (datetime('now'))
				)`,
				(err: Error | null) => {
					if (err) return reject(err)
					resolve()
				}
			)
		})
	})
}

export function createTask(input: CreateTaskInput): Promise<TaskRow> {
	return new Promise((resolve, reject) => {
		db.run(
			`INSERT INTO tasks (username, email, text) VALUES (?, ?, ?)`,
			[input.username, input.email, input.text],
			function (this: sqlite3.RunResult, err: Error | null) {
				if (err) return reject(err)
				db.get(`SELECT * FROM tasks WHERE id = ?`, [this.lastID], (getErr: Error | null, row: TaskRow | undefined) => {
					if (getErr) return reject(getErr)
					if (!row) return reject(new Error('Task not found after creation'))
					resolve(row)
				})
			}
		)
	})
}

export function updateTask(id: number, input: UpdateTaskInput): Promise<TaskRow | null> {
	return new Promise((resolve, reject) => {
		db.get(`SELECT * FROM tasks WHERE id = ?`, [id], (selErr: Error | null, existing: TaskRow | undefined) => {
			if (selErr) return reject(selErr)
			if (!existing) return resolve(null)

			const setParts: string[] = []
			const values: any[] = []

			if (typeof input.text === 'string') {
				setParts.push('text = ?')
				values.push(input.text)
				if (input.text !== existing.text) {
					setParts.push('edited_by_admin = 1')
				}
			}
			if (typeof input.completed === 'boolean') {
				setParts.push('completed = ?')
				values.push(input.completed ? 1 : 0)
			}

			if (setParts.length === 0) return resolve(existing)

			values.push(id)
			db.run(`UPDATE tasks SET ${setParts.join(', ')} WHERE id = ?`, values, (updErr: Error | null) => {
				if (updErr) return reject(updErr)
				db.get(`SELECT * FROM tasks WHERE id = ?`, [id], (getErr: Error | null, row: TaskRow | undefined) => {
					if (getErr) return reject(getErr)
					resolve(row || null)
				})
			})
		})
	})
}

export interface PaginatedTasks {
	items: TaskRow[]
	total: number
	page: number
	pages: number
}

export function listTasks(
	page: number,
	sort: SortField,
	order: SortOrder
): Promise<PaginatedTasks> {
	const limit = 3
	const offset = (page - 1) * limit

	const sortColumn = sort === 'status' ? 'completed' : sort
	const orderSql = order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'

	return new Promise((resolve, reject) => {
		db.get(`SELECT COUNT(*) as cnt FROM tasks`, [], (cntErr: Error | null, cntRow: { cnt: number } | undefined) => {
			if (cntErr) return reject(cntErr)
			const total = cntRow?.cnt ?? 0
			db.all(
				`SELECT * FROM tasks ORDER BY ${sortColumn} ${orderSql} LIMIT ? OFFSET ?`,
				[limit, offset],
				(listErr: Error | null, rows: TaskRow[]) => {
					if (listErr) return reject(listErr)
					resolve({
						items: rows,
						total,
						page,
						pages: Math.max(1, Math.ceil(total / limit)),
					})
				}
			)
		})
	})
}