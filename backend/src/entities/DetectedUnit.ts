import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('detected_units')
export class DetectedUnit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  imei: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  firstSeenAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  lastSeenAt: Date;

  @Column({ default: 0 })
  totalMessages: number;

  @Column({ default: false })
  linked: boolean;
}
