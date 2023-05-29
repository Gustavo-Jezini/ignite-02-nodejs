import { randomUUID } from 'crypto'
import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { knex } from '../database'
import { checkSessionIdExist } from '../middlewares/check-session-id-exists'

// Cookies <-> Formas da gente manter contexto entre requisições

// TESTES -
// UNITÁRIOS: Unidade da sua aplicação <-> testa pequenos pedaços
// INTEGRAÇÃO: Comunicação entre duas ou mais unidades
// e2e - ponta a ponta: Simulam um usuário operando na nossa aplicação

// Pirâmide de testes: E2E (Não depende de nenhuma tecnologia, não dependendem arquitetura)

export async function transactionsRoutes(app: FastifyInstance) {
  // É um pre handler global
  // Antes de qualquer plugin ele é rodado

  // app.addHook('preHandler', async (request, reply) => {
  //   console.log('Eai Meu Bem')
  // })

  app.get(
    '/',
    {
      preHandler: [checkSessionIdExist],
    },
    async (request, reply) => {
      const { sessionId } = request.cookies

      const transactions = await knex('transactions')
        .where('session_id', sessionId)
        .select()

      return reply.status(200).send({ transactions })
    },
  )

  app.get(
    '/:id',

    {
      preHandler: [checkSessionIdExist],
    },

    async (request, reply) => {
      const getTransactionParamsSchema = z.object({
        id: z.string().uuid(),
      })

      const { sessionId } = request.cookies

      const { id } = getTransactionParamsSchema.parse(request.params)

      const transaction = await knex('transactions')
        .where({
          session_id: sessionId,
          id,
        })
        .first()

      return {
        transaction,
      }
    },
  )

  app.get(
    '/summary',

    {
      preHandler: [checkSessionIdExist],
    },

    async (request) => {
      const { sessionId } = request.cookies
      const summary = await knex('transactions')
        .where('session_id', sessionId)
        .sum('amount', { as: 'amount' })
        .first()

      return {
        summary,
      }
    },
  )

  app.post('/', async (request, reply) => {
    // { title, amount, type: credit ou debit }

    const createTransactionBodySchema = z.object({
      title: z.string(),
      amount: z.number(),
      type: z.enum(['credit', 'debit']),
    })

    // Se as informações do req.body não forem validadas pelo Zod -> throw Error
    const { title, amount, type } = createTransactionBodySchema.parse(
      request.body,
    )

    let sessionId = request.cookies.sessionId

    if (!sessionId) {
      sessionId = randomUUID()

      reply.cookie('sessionId', sessionId, {
        path: '/',
        maxAge: 1000 * 60 * 60 * 7, // 7 days
      })
    }

    await knex('transactions').insert({
      id: randomUUID(),
      title,
      amount: type === 'credit' ? amount : amount * -1,
      session_id: sessionId,
    })

    // HTTP Codes
    // 201 -> Recurso criado com sucesso
    return reply.status(201).send()
  })
}
