import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

interface ProjectServiceJwtPayload {
  sub?: string;
  id?: string;
  email: string;
  name?: string;
  role?: string;
}

export interface AuthenticatedMember {
  id: string;
  email: string;
  name: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        ExtractJwt.fromUrlQueryParameter('token'),
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: ProjectServiceJwtPayload): AuthenticatedMember {
    const memberId = payload?.sub || payload?.id;
    if (!memberId || !payload?.email) {
      throw new UnauthorizedException('Invalid token payload');
    }

    return {
      id: memberId,
      email: payload.email,
      name: payload.name || payload.email.split('@')[0],
      role: payload.role || 'Member',
    };
  }
}
