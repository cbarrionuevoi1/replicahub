import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './User';

@Entity('report_exports')
export class ReportExport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  format: string;

  @Column({ type: 'json', nullable: true })
  filters: any;

  @Column({ type: 'int', default: 0 })
  rowCount: number;

  @CreateDateColumn()
  createdAt: Date;
}
