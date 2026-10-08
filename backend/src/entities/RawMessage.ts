import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('raw_messages')
export class RawMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  imei: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  messageHash: string | null;

  @Column({ type: 'text' })
  rawData: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  receivedAt: Date;

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ type: 'uuid', nullable: true })
  unitId: string;

  @Column({ type: 'uuid', nullable: true })
  clientId: string;

  @Column({ default: 'PROCESSED' })
  status: string; // 'PROCESSED', 'UNIDENTIFIED', 'ERROR'

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ type: 'json', nullable: true })
  decodedData: any;
}
