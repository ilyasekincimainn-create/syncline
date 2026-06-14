import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtOptions } from '@syncline/shared';
declare function getJwtOptions(): JwtOptions;
export declare function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<undefined>;
declare module 'fastify' {
    interface FastifyRequest {
        user?: any;
    }
}
export { getJwtOptions };
//# sourceMappingURL=auth.d.ts.map