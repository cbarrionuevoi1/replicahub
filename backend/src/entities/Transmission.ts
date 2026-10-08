import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('transmissions')
export class Transmission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  unitId: string;

  @Column()
  plate: string;

  @Column()
  imei: string;

  @Column({ nullable: true })
  clientName: string;

  @Column({ type: 'uuid' })
  repeaterId: string;

  @Column()
  repeaterName: string;

  @Column()
  status: string;

  @Column({ nullable: true })
  httpCode: number;

  @Column({ type: 'int', nullable: true })
  durationMs: number;

  @Column({ default: 1 })
  attempts: number;

  @Column({ type: 'timestamp', nullable: true })
  eventTime: Date;

  @Column({ type: 'timestamp', nullable: true })
  receivedAt: Date;

  @Column({ type: 'json', nullable: true })
  payloadSent: any;

  @Column({ type: 'json', nullable: true })
  responseReceived: any;

  @Column({ type: 'text', nullable: true })
  error: string;

  @Column({ type: 'uuid', nullable: true })
  positionId: string;

  @Column({ type: 'uuid', nullable: true })
  rawMessageId: string;

  @CreateDateColumn()
  createdAt: Date;
}
