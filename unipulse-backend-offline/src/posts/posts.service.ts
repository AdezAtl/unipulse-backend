import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PostsService {
  constructor(private prisma: PrismaService) {}

  create(userId: string, dto: any) {
    return this.prisma.post.create({ data: { authorId: userId, ...dto } });
  }

  findAll() {
    return this.prisma.post.findMany({ include: { author: true, comments: true } });
  }

  comment(userId: string, postId: string, content: string) {
    return this.prisma.comment.create({ data: { postId, authorId: userId, content } });
  }

  like(postId: string) {
    return this.prisma.post.update({ where: { id: postId }, data: { likes: { increment: 1 } } });
  }

  favorite(userId: string, postId: string) {
    return this.prisma.favorite.create({ data: { userId, postId } });
  }
}