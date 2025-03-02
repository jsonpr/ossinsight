import {FastifyPluginAsyncJsonSchemaToTs} from "@fastify/type-provider-json-schema-to-ts";
import { Auth0User, parseAuth0User } from "../../../plugins/auth/auth0";

const schema = {
  summary: 'Answer new a question',
  description: 'Answer a question to the AI bot, he will return a sql query, and execute the query to get the result.',
  tags: ['explorer'],
  body: {
    type: 'object',
    properties: {
      question: { type: 'string' },
      ignoreCache: { type: 'boolean', default: false }
    }
  } as const
};

export interface IBody {
  question: string;
  ignoreCache: boolean;
}

export const newQuestionHandler: FastifyPluginAsyncJsonSchemaToTs = async (app): Promise<void> => {
  app.post<{
    Body: IBody;
  }>('/', {
    schema,
    preValidation: app.authenticate
  }, async function (req, reply) {
    const { explorerService } = app;
    const conn = await this.mysql.getConnection();

    // Get user id from auth0.
    const { sub, metadata } = parseAuth0User(req.user as Auth0User);
    const userId = await app.userService.findOrCreateUserByAccount(
      { ...metadata, sub },
      req.headers.authorization
    );
    const { question: questionTitle, ignoreCache } = req.body;

    try {
      const question = await explorerService.newQuestion(userId, questionTitle, ignoreCache, false, false, null, conn);

      // Prepare question async.
      if (!question.hitCache) {
        explorerService.prepareQuestion(question).catch(err => {
          app.log.error(err, `Failed to prepare question ${question.id}: ${err.message}`);
        });
      }

      reply.status(200).send(question);
    } catch (e) {
      throw e;
    } finally {
      conn.release();
    }
  });
}

export default newQuestionHandler;
