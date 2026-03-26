import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...\n');

  // ─── Clean slate ───────────────────────────────────────────────────────────
  await prisma.notification.deleteMany();
  await prisma.readState.deleteMany();
  await prisma.reaction.deleteMany();
  await prisma.message.deleteMany();
  await prisma.invite.deleteMany();
  await prisma.dMParticipant.deleteMany();
  await prisma.dMConversation.deleteMany();
  await prisma.userRelationship.deleteMany();
  await prisma.guildMember.deleteMany();
  await prisma.permissionOverwrite.deleteMany();
  await prisma.channel.deleteMany();
  await prisma.category.deleteMany();
  await prisma.role.deleteMany();
  await prisma.guild.deleteMany();
  await prisma.presenceState.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  const BCRYPT_ROUNDS = 12;
  const PASSWORD = 'Password123!';

  // ─── Users ─────────────────────────────────────────────────────────────────
  const [aliceHash, bobHash, charlieHash] = await Promise.all([
    bcrypt.hash(PASSWORD, BCRYPT_ROUNDS),
    bcrypt.hash(PASSWORD, BCRYPT_ROUNDS),
    bcrypt.hash(PASSWORD, BCRYPT_ROUNDS),
  ]);

  const alice = await prisma.user.create({
    data: {
      email: 'alice@constchat.dev',
      username: 'alice',
      discriminator: '0001',
      passwordHash: aliceHash,
      globalName: 'Alice Admin',
      bio: 'Server owner and lead developer',
      verified: true,
      flags: BigInt(1),
      presenceState: {
        create: { status: 'ONLINE' },
      },
    },
  });

  const bob = await prisma.user.create({
    data: {
      email: 'bob@constchat.dev',
      username: 'bob',
      discriminator: '0002',
      passwordHash: bobHash,
      globalName: 'Bob Dev',
      bio: 'Frontend engineer, React enthusiast',
      verified: true,
      flags: BigInt(0),
      presenceState: {
        create: { status: 'ONLINE' },
      },
    },
  });

  const charlie = await prisma.user.create({
    data: {
      email: 'charlie@constchat.dev',
      username: 'charlie',
      discriminator: '0003',
      passwordHash: charlieHash,
      globalName: 'Charlie Mod',
      bio: 'Community moderator and tester',
      verified: true,
      flags: BigInt(0),
      presenceState: {
        create: { status: 'IDLE' },
      },
    },
  });

  console.log(`Created users: alice (${alice.id}), bob (${bob.id}), charlie (${charlie.id})`);

  // ─── Friend relationships ────────────────────────────────────────────────
  await prisma.userRelationship.createMany({
    data: [
      { requesterId: alice.id, targetId: bob.id, type: 'FRIEND' },
      { requesterId: bob.id, targetId: alice.id, type: 'FRIEND' },
      { requesterId: alice.id, targetId: charlie.id, type: 'FRIEND' },
      { requesterId: charlie.id, targetId: alice.id, type: 'FRIEND' },
      { requesterId: bob.id, targetId: charlie.id, type: 'FRIEND' },
      { requesterId: charlie.id, targetId: bob.id, type: 'FRIEND' },
    ],
  });

  console.log('Created friend relationships');

  // ─── Guild ─────────────────────────────────────────────────────────────────
  const guild = await prisma.guild.create({
    data: {
      name: 'ConstChat HQ',
      description: 'The official ConstChat development server. Welcome!',
      ownerId: alice.id,
      memberCount: 3,
      features: ['COMMUNITY', 'DISCOVERABLE'],
      isDiscoverable: true,
    },
  });

  console.log(`Created guild: ${guild.name} (${guild.id})`);

  // ─── Roles ─────────────────────────────────────────────────────────────────
  const ADMIN_PERMISSIONS = BigInt('0x0000000000000008'); // ADMINISTRATOR

  const MOD_PERMISSIONS =
    BigInt(1) |
    (BigInt(1) << BigInt(1)) |  // KICK_MEMBERS
    (BigInt(1) << BigInt(2)) |  // BAN_MEMBERS
    (BigInt(1) << BigInt(7)) |  // VIEW_AUDIT_LOG
    (BigInt(1) << BigInt(10)) | // VIEW_CHANNEL
    (BigInt(1) << BigInt(11)) | // SEND_MESSAGES
    (BigInt(1) << BigInt(13)) | // MANAGE_MESSAGES
    (BigInt(1) << BigInt(16)) | // READ_MESSAGE_HISTORY
    (BigInt(1) << BigInt(40));  // MODERATE_MEMBERS

  const MEMBER_PERMISSIONS =
    (BigInt(1) << BigInt(10)) | // VIEW_CHANNEL
    (BigInt(1) << BigInt(11)) | // SEND_MESSAGES
    (BigInt(1) << BigInt(14)) | // EMBED_LINKS
    (BigInt(1) << BigInt(15)) | // ATTACH_FILES
    (BigInt(1) << BigInt(16)) | // READ_MESSAGE_HISTORY
    (BigInt(1) << BigInt(6)) |  // ADD_REACTIONS
    (BigInt(1) << BigInt(20)) | // CONNECT
    (BigInt(1) << BigInt(21)) | // SPEAK
    (BigInt(1) << BigInt(25)) | // USE_VAD
    (BigInt(1) << BigInt(31));  // USE_APPLICATION_COMMANDS

  const everyoneRole = await prisma.role.create({
    data: {
      guildId: guild.id,
      name: '@everyone',
      position: 0,
      color: 0,
      permissionsInteger: MEMBER_PERMISSIONS,
    },
  });

  const memberRole = await prisma.role.create({
    data: {
      guildId: guild.id,
      name: 'Member',
      position: 1,
      color: 0x3498db,
      hoist: true,
      mentionable: true,
      permissionsInteger: MEMBER_PERMISSIONS,
    },
  });

  const modRole = await prisma.role.create({
    data: {
      guildId: guild.id,
      name: 'Moderator',
      position: 2,
      color: 0x2ecc71,
      hoist: true,
      mentionable: true,
      permissionsInteger: MOD_PERMISSIONS,
    },
  });

  const adminRole = await prisma.role.create({
    data: {
      guildId: guild.id,
      name: 'Admin',
      position: 3,
      color: 0xe74c3c,
      hoist: true,
      mentionable: true,
      permissionsInteger: ADMIN_PERMISSIONS,
    },
  });

  console.log('Created roles: @everyone, Member, Moderator, Admin');

  // ─── Categories & Channels ─────────────────────────────────────────────────
  const generalCategory = await prisma.category.create({
    data: { guildId: guild.id, name: 'General', position: 0 },
  });

  const offTopicCategory = await prisma.category.create({
    data: { guildId: guild.id, name: 'Off-Topic', position: 1 },
  });

  const devCategory = await prisma.category.create({
    data: { guildId: guild.id, name: 'Development', position: 2 },
  });

  const generalText = await prisma.channel.create({
    data: {
      guildId: guild.id,
      name: 'general',
      type: 'TEXT',
      position: 0,
      parentId: generalCategory.id,
      topic: 'General discussion for ConstChat HQ',
    },
  });

  const welcomeText = await prisma.channel.create({
    data: {
      guildId: guild.id,
      name: 'welcome',
      type: 'TEXT',
      position: 1,
      parentId: generalCategory.id,
      topic: 'Say hello to new members!',
    },
  });

  const generalVoice = await prisma.channel.create({
    data: {
      guildId: guild.id,
      name: 'General Voice',
      type: 'VOICE',
      position: 2,
      parentId: generalCategory.id,
      bitrate: 64000,
      userLimit: 0,
    },
  });

  const offTopicText = await prisma.channel.create({
    data: {
      guildId: guild.id,
      name: 'off-topic',
      type: 'TEXT',
      position: 0,
      parentId: offTopicCategory.id,
      topic: 'Anything goes (within reason)',
    },
  });

  const memesText = await prisma.channel.create({
    data: {
      guildId: guild.id,
      name: 'memes',
      type: 'TEXT',
      position: 1,
      parentId: offTopicCategory.id,
      topic: 'Share your best memes',
    },
  });

  const devText = await prisma.channel.create({
    data: {
      guildId: guild.id,
      name: 'dev-chat',
      type: 'TEXT',
      position: 0,
      parentId: devCategory.id,
      topic: 'Development discussion, PRs, issues',
    },
  });

  const devVoice = await prisma.channel.create({
    data: {
      guildId: guild.id,
      name: 'Dev Voice',
      type: 'VOICE',
      position: 1,
      parentId: devCategory.id,
      bitrate: 96000,
      userLimit: 10,
    },
  });

  const bugReports = await prisma.channel.create({
    data: {
      guildId: guild.id,
      name: 'bug-reports',
      type: 'TEXT',
      position: 2,
      parentId: devCategory.id,
      topic: 'Report bugs and issues here',
    },
  });

  await prisma.guild.update({
    where: { id: guild.id },
    data: { systemChannelId: generalText.id },
  });

  console.log('Created categories and channels');

  // ─── Guild Members ─────────────────────────────────────────────────────────
  await prisma.guildMember.create({
    data: {
      guildId: guild.id,
      userId: alice.id,
      roles: [everyoneRole.id, memberRole.id, adminRole.id],
      isOwner: true,
    },
  });

  await prisma.guildMember.create({
    data: {
      guildId: guild.id,
      userId: bob.id,
      roles: [everyoneRole.id, memberRole.id],
    },
  });

  await prisma.guildMember.create({
    data: {
      guildId: guild.id,
      userId: charlie.id,
      roles: [everyoneRole.id, memberRole.id, modRole.id],
    },
  });

  console.log('Added members: alice (Admin+Owner), bob (Member), charlie (Moderator)');

  // ─── Seed Messages ─────────────────────────────────────────────────────────
  const now = new Date();
  const msgs: { channelId: string; authorId: string; content: string; createdAt: Date }[] = [];

  // #general messages
  const generalMsgs = [
    { authorId: alice.id, content: 'Welcome to ConstChat HQ! This is our official development server.', mins: 120 },
    { authorId: alice.id, content: '**Server Rules**\n1. Be respectful to all members\n2. No spam or self-promotion\n3. Keep discussions on-topic\n4. Have fun!', mins: 119 },
    { authorId: bob.id, content: 'Hey everyone! Excited to be here', mins: 90 },
    { authorId: charlie.id, content: 'Welcome Bob! Good to have you on board.', mins: 85 },
    { authorId: alice.id, content: 'The app is coming together nicely. We have chat, voice rooms, and the real-time gateway working.', mins: 60 },
    { authorId: bob.id, content: 'The UI looks amazing. Clean dark theme with that indigo accent is chef\'s kiss', mins: 55 },
    { authorId: charlie.id, content: 'I just tested the voice channels - audio quality is solid. WebRTC via LiveKit was a good call.', mins: 30 },
    { authorId: alice.id, content: 'Thanks! Next up is getting the demo fully runnable locally.', mins: 20 },
    { authorId: bob.id, content: 'Let me know if you need help with anything frontend-wise', mins: 15 },
    { authorId: charlie.id, content: 'I can help test the moderation tools once they\'re wired up', mins: 10 },
  ];

  for (const m of generalMsgs) {
    msgs.push({
      channelId: generalText.id,
      authorId: m.authorId,
      content: m.content,
      createdAt: new Date(now.getTime() - m.mins * 60 * 1000),
    });
  }

  // #dev-chat messages
  const devMsgs = [
    { authorId: alice.id, content: 'The backend API is built with NestJS + Fastify + Prisma. Check the README for setup instructions.', mins: 100 },
    { authorId: bob.id, content: 'The database schema looks solid! Happy to help with the frontend.', mins: 95 },
    { authorId: alice.id, content: 'Frontend stack: Next.js 14, Tailwind CSS, Zustand for state, Framer Motion for animations.', mins: 80 },
    { authorId: charlie.id, content: 'How are we handling WebSocket connections? Is there a retry mechanism?', mins: 70 },
    { authorId: alice.id, content: 'Yes - the GatewayClient handles reconnection with exponential backoff (max 10 attempts). It also supports RESUME to replay missed events.', mins: 65 },
    { authorId: bob.id, content: 'Nice! The event architecture feels very Discord-like. HELLO -> IDENTIFY -> READY flow is clean.', mins: 50 },
    { authorId: alice.id, content: 'Voice is handled by a separate media-signalling service that manages LiveKit rooms and issues tokens.', mins: 40 },
    { authorId: charlie.id, content: 'What about rate limiting? Do we have per-endpoint throttling?', mins: 25 },
    { authorId: alice.id, content: 'Global throttle is 100 requests per 60 seconds. Per-endpoint granularity is on the roadmap.', mins: 20 },
  ];

  for (const m of devMsgs) {
    msgs.push({
      channelId: devText.id,
      authorId: m.authorId,
      content: m.content,
      createdAt: new Date(now.getTime() - m.mins * 60 * 1000),
    });
  }

  // #off-topic
  const offTopicMsgs = [
    { authorId: bob.id, content: 'Anyone watching any good tech talks lately?', mins: 45 },
    { authorId: charlie.id, content: 'I just watched the latest Fireship video on WebRTC. Pretty relevant to what we\'re building!', mins: 40 },
    { authorId: alice.id, content: 'Oh that\'s a good one. His 100 seconds series is always great.', mins: 35 },
  ];

  for (const m of offTopicMsgs) {
    msgs.push({
      channelId: offTopicText.id,
      authorId: m.authorId,
      content: m.content,
      createdAt: new Date(now.getTime() - m.mins * 60 * 1000),
    });
  }

  // #bug-reports
  const bugMsgs = [
    { authorId: charlie.id, content: 'Found a minor issue: emoji picker doesn\'t close when you click outside of it in some cases.', mins: 50 },
    { authorId: alice.id, content: 'Good catch! I\'ll add that to the fix list.', mins: 48 },
  ];

  for (const m of bugMsgs) {
    msgs.push({
      channelId: bugReports.id,
      authorId: m.authorId,
      content: m.content,
      createdAt: new Date(now.getTime() - m.mins * 60 * 1000),
    });
  }

  // #welcome
  const welcomeMsgs = [
    { authorId: alice.id, content: 'Welcome to ConstChat HQ! Make sure to read the rules in #general and introduce yourself here.', mins: 118 },
    { authorId: bob.id, content: 'Hi all! I\'m Bob, frontend dev. Looking forward to contributing.', mins: 89 },
    { authorId: charlie.id, content: 'Hey! I\'m Charlie, handling moderation and QA. Feel free to reach out if you need anything.', mins: 84 },
  ];

  for (const m of welcomeMsgs) {
    msgs.push({
      channelId: welcomeText.id,
      authorId: m.authorId,
      content: m.content,
      createdAt: new Date(now.getTime() - m.mins * 60 * 1000),
    });
  }

  // Bulk create all messages
  let lastMsgIds: Record<string, string> = {};
  for (const msg of msgs) {
    const created = await prisma.message.create({
      data: {
        channelId: msg.channelId,
        guildId: guild.id,
        authorId: msg.authorId,
        content: msg.content,
        type: 'DEFAULT',
        createdAt: msg.createdAt,
      },
    });
    lastMsgIds[msg.channelId] = created.id;
  }

  // Update lastMessageId on channels
  for (const [channelId, messageId] of Object.entries(lastMsgIds)) {
    await prisma.channel.update({
      where: { id: channelId },
      data: { lastMessageId: messageId },
    });
  }

  console.log(`Created ${msgs.length} seed messages`);

  // ─── DM Conversations ─────────────────────────────────────────────────────
  const dmAliceBob = await prisma.dMConversation.create({
    data: {
      type: 'DM',
      participants: {
        create: [
          { userId: alice.id },
          { userId: bob.id },
        ],
      },
    },
  });

  const dmAliceCharlie = await prisma.dMConversation.create({
    data: {
      type: 'DM',
      participants: {
        create: [
          { userId: alice.id },
          { userId: charlie.id },
        ],
      },
    },
  });

  // DM messages need channels — create DM channels
  const dmChannelAB = await prisma.channel.create({
    data: {
      name: 'DM',
      type: 'DM',
      position: 0,
    },
  });

  const dmChannelAC = await prisma.channel.create({
    data: {
      name: 'DM',
      type: 'DM',
      position: 0,
    },
  });

  // Update DM conversations with lastMessageId references
  const dmMsgAB1 = await prisma.message.create({
    data: {
      channelId: dmChannelAB.id,
      authorId: alice.id,
      content: 'Hey Bob, how\'s the frontend work going?',
      type: 'DEFAULT',
      createdAt: new Date(now.getTime() - 75 * 60 * 1000),
    },
  });

  const dmMsgAB2 = await prisma.message.create({
    data: {
      channelId: dmChannelAB.id,
      authorId: bob.id,
      content: 'Going great! The message composer is feature-complete. Working on polishing animations now.',
      type: 'DEFAULT',
      createdAt: new Date(now.getTime() - 70 * 60 * 1000),
    },
  });

  const dmMsgAB3 = await prisma.message.create({
    data: {
      channelId: dmChannelAB.id,
      authorId: alice.id,
      content: 'Awesome. Let me know when you\'re ready for a code review.',
      type: 'DEFAULT',
      createdAt: new Date(now.getTime() - 65 * 60 * 1000),
    },
  });

  const dmMsgAC1 = await prisma.message.create({
    data: {
      channelId: dmChannelAC.id,
      authorId: charlie.id,
      content: 'Alice, I finished testing the invite system. Works great!',
      type: 'DEFAULT',
      createdAt: new Date(now.getTime() - 55 * 60 * 1000),
    },
  });

  const dmMsgAC2 = await prisma.message.create({
    data: {
      channelId: dmChannelAC.id,
      authorId: alice.id,
      content: 'Perfect, thanks for testing! Any edge cases I should know about?',
      type: 'DEFAULT',
      createdAt: new Date(now.getTime() - 50 * 60 * 1000),
    },
  });

  await prisma.dMConversation.update({
    where: { id: dmAliceBob.id },
    data: { lastMessageId: dmMsgAB3.id },
  });

  await prisma.dMConversation.update({
    where: { id: dmAliceCharlie.id },
    data: { lastMessageId: dmMsgAC2.id },
  });

  console.log('Created DM conversations with messages');

  // ─── Invites ──────────────────────────────────────────────────────────────
  const invite = await prisma.invite.create({
    data: {
      code: 'constchat-demo',
      guildId: guild.id,
      channelId: generalText.id,
      inviterId: alice.id,
      maxAge: 0, // never expires
      maxUses: 0, // unlimited
    },
  });

  console.log(`Created invite: ${invite.code}`);

  // ─── Read States ───────────────────────────────────────────────────────────
  const allTextChannels = [generalText, welcomeText, offTopicText, devText, bugReports, memesText];
  const allUsers = [alice, bob, charlie];

  for (const user of allUsers) {
    for (const ch of allTextChannels) {
      const lastMsgId = lastMsgIds[ch.id];
      if (lastMsgId) {
        await prisma.readState.create({
          data: {
            userId: user.id,
            channelId: ch.id,
            lastReadMessageId: lastMsgId,
            mentionCount: 0,
          },
        });
      }
    }
  }

  console.log('Created read states');

  // ─── Summary ───────────────────────────────────────────────────────────────
  console.log('\n========================================');
  console.log('  Database seeded successfully!');
  console.log('========================================');
  console.log('\nTest accounts (all use the same password):');
  console.log('  Password: Password123!\n');
  console.log('  alice@constchat.dev  — Admin + Owner');
  console.log('  bob@constchat.dev    — Member');
  console.log('  charlie@constchat.dev — Moderator\n');
  console.log(`Guild: ConstChat HQ (${guild.id})`);
  console.log(`Invite code: constchat-demo`);
  console.log(`Channels: ${allTextChannels.length} text + 2 voice`);
  console.log(`Messages: ${msgs.length + 5} total`);
  console.log('========================================\n');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
