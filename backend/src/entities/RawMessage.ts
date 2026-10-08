import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('raw_messages')
export class RawMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  imei: string;

  @Column({ type: 'text' })
  rawData: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  receivedAt: Date;
}
