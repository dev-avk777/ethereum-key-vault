import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm'

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ unique: true, type: 'varchar' })
  email: string

  @Column({ nullable: true, type: 'varchar' })
  password: string | null

  @Column({ unique: true, type: 'varchar', nullable: true })
  publicKey: string | null

  @Column({
    nullable: true,
    name: 'substrate_public_key',
    type: 'varchar',
    unique: true,
  })
  substratePublicKey: string | null

  @Column({ nullable: true, name: 'google_id', type: 'varchar' })
  googleId: string | null

  @Column({ nullable: true, name: 'display_name', type: 'varchar' })
  displayName: string | null

  @CreateDateColumn()
  createdAt: Date
}
