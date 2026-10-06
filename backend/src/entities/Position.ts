import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('positions')
export class Position {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  messageId: string;

  @Column()
  source: string;

  @Column({ nullable: true })
  deviceId: string;

  @Index()
  @Column()
  imei: string;

  @Index()
  @Column({ type: 'timestamp' })
  eventTime: Date;

  @Index()
  @Column({ type: 'timestamp' })
  receivedAt: Date;

  @Column({ type: 'float', nullable: true })
  latitude: number;

  @Column({ type: 'float', nullable: true })
  longitude: number;

  @Column({ type: 'float', nullable: true })
  speed: number;

  @Column({ type: 'float', nullable: true })
  course: number;

  @Column({ type: 'float', nullable: true })
  altitude: number;

  @Column({ type: 'int', nullable: true })
  satellites: number;

  @Column({ nullable: true })
  ignition: boolean;

  @Column({ type: 'json', nullable: true })
  parameters: any;

  @Column({ nullable: true })
  rawMessageId: string;

  @CreateDateColumn()
  createdAt: Date;
}
