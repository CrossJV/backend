import { db, initDb } from './db'

async function seed() {
	await initDb()
	await new Promise<void>((resolve, reject) => {
		db.serialize(() => {
			db.run('DELETE FROM tasks', (err) => { if (err) return reject(err) })
			const stmt = db.prepare('INSERT INTO tasks (username, email, text, completed) VALUES (?, ?, ?, ?)')
			const rows: [string, string, string, number][] = [
				['Иван', 'ivan@example.com', 'Починить баг в проде', 0],
				['Анна', 'anna@example.com', 'Подготовить отчёт', 1],
				['Павел', 'pavel@example.com', 'Сверстать лендинг', 0],
				['Ольга', 'olga@example.com', 'Обновить документацию', 0],
				['Юлия', 'yulia@example.com', 'Настроить мониторинг', 1],
			]
			for (const r of rows) stmt.run(r)
			stmt.finalize((finalizeErr) => { if (finalizeErr) return reject(finalizeErr); resolve() })
		})
	})
	console.log('Seed done')
	process.exit(0)
}

seed().catch((e) => { console.error(e); process.exit(1) }) 