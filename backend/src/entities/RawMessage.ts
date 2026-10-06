import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('raw_messages')
export class RawMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  imei: string;

  @Column({ type: 'text' })
  payload: string;

  @Column({ nullable: true })
  source: string;

  @CreateDateColumn()
  createdAt: Date;
}
