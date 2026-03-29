'use client';

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  Smile,
  Dog,
  Coffee,
  Plane,
  Gamepad2,
  Lightbulb,
  Hash,
  Flag,
  Search,
  X,
  Star,
} from 'lucide-react';
import { useGuildsStore } from '@/stores/guilds.store';
import { useUIStore } from '@/stores/ui.store';

// ---------------------------------------------------------------------------
// Emoji data — compact inline dataset (most popular per category)
// ---------------------------------------------------------------------------

interface EmojiEntry {
  emoji: string;
  name: string;
  keywords?: string[];
}

interface EmojiCategory {
  id: string;
  name: string;
  icon: ReactNode;
  emojis: EmojiEntry[];
}

const SKIN_TONES = [
  { modifier: '', label: 'Default' },
  { modifier: '\u{1F3FB}', label: 'Light' },
  { modifier: '\u{1F3FC}', label: 'Medium-Light' },
  { modifier: '\u{1F3FD}', label: 'Medium' },
  { modifier: '\u{1F3FE}', label: 'Medium-Dark' },
  { modifier: '\u{1F3FF}', label: 'Dark' },
];

const SKIN_TONE_BASE = [
  '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟',
  '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊',
  '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '💪', '🦶',
  '🦵', '👂', '🦻', '👃', '👶', '🧒', '👦', '👧', '🧑', '👱', '👨',
  '🧔', '👩', '🧓', '👴', '👵', '🙍', '🙎', '🙅', '🙆', '💁', '🙋',
  '🧏', '🙇', '🤦', '🤷', '👮', '🕵️', '💂', '🥷', '👷', '🤴', '👸',
  '👳', '👲', '🧕', '🤵', '👰', '🤰', '🫃', '🫄', '🤱', '👼', '🎅',
  '🤶', '🦸', '🦹', '🧙', '🧚', '🧛', '🧜', '🧝', '🧞', '🧟', '💆',
  '💇', '🚶', '🧍', '🧎', '🏃', '💃', '🕺', '🕴️', '🧖', '🧗', '🏇',
  '🏂', '🏌️', '🏄', '🚣', '🏊', '⛹️', '🏋️', '🚴', '🚵', '🤸', '🤽',
  '🤾', '🤺', '🤹',
];

const CATEGORIES: EmojiCategory[] = [
  {
    id: 'smileys',
    name: 'Smileys & People',
    icon: <Smile size={16} />,
    emojis: [
      { emoji: '😀', name: 'grinning face', keywords: ['happy', 'smile'] },
      { emoji: '😃', name: 'grinning face with big eyes', keywords: ['happy'] },
      { emoji: '😄', name: 'grinning face with smiling eyes', keywords: ['happy'] },
      { emoji: '😁', name: 'beaming face', keywords: ['grin'] },
      { emoji: '😆', name: 'grinning squinting face', keywords: ['laugh'] },
      { emoji: '😅', name: 'grinning face with sweat', keywords: ['hot'] },
      { emoji: '🤣', name: 'rolling on the floor laughing', keywords: ['rofl', 'lol'] },
      { emoji: '😂', name: 'face with tears of joy', keywords: ['cry', 'laugh'] },
      { emoji: '🙂', name: 'slightly smiling face', keywords: ['smile'] },
      { emoji: '🙃', name: 'upside-down face', keywords: ['sarcasm'] },
      { emoji: '😉', name: 'winking face', keywords: ['wink'] },
      { emoji: '😊', name: 'smiling face with smiling eyes', keywords: ['blush'] },
      { emoji: '😇', name: 'smiling face with halo', keywords: ['angel'] },
      { emoji: '🥰', name: 'smiling face with hearts', keywords: ['love'] },
      { emoji: '😍', name: 'smiling face with heart-eyes', keywords: ['love'] },
      { emoji: '🤩', name: 'star-struck', keywords: ['star', 'wow'] },
      { emoji: '😘', name: 'face blowing a kiss', keywords: ['kiss'] },
      { emoji: '😗', name: 'kissing face', keywords: ['kiss'] },
      { emoji: '😚', name: 'kissing face with closed eyes', keywords: ['kiss'] },
      { emoji: '😙', name: 'kissing face with smiling eyes', keywords: ['kiss'] },
      { emoji: '🥲', name: 'smiling face with tear', keywords: ['sad', 'happy'] },
      { emoji: '😋', name: 'face savoring food', keywords: ['yum', 'delicious'] },
      { emoji: '😛', name: 'face with tongue', keywords: ['tongue'] },
      { emoji: '😜', name: 'winking face with tongue', keywords: ['prank'] },
      { emoji: '🤪', name: 'zany face', keywords: ['crazy', 'wild'] },
      { emoji: '😝', name: 'squinting face with tongue', keywords: ['tongue'] },
      { emoji: '🤑', name: 'money-mouth face', keywords: ['money', 'rich'] },
      { emoji: '🤗', name: 'hugging face', keywords: ['hug'] },
      { emoji: '🤭', name: 'face with hand over mouth', keywords: ['oops', 'giggle'] },
      { emoji: '🤫', name: 'shushing face', keywords: ['quiet', 'secret'] },
      { emoji: '🤔', name: 'thinking face', keywords: ['think', 'hmm'] },
      { emoji: '🫡', name: 'saluting face', keywords: ['salute'] },
      { emoji: '🤐', name: 'zipper-mouth face', keywords: ['zip', 'secret'] },
      { emoji: '🤨', name: 'face with raised eyebrow', keywords: ['skeptical'] },
      { emoji: '😐', name: 'neutral face', keywords: ['meh', 'indifferent'] },
      { emoji: '😑', name: 'expressionless face', keywords: ['blank'] },
      { emoji: '😶', name: 'face without mouth', keywords: ['silent'] },
      { emoji: '🫥', name: 'dotted line face', keywords: ['invisible'] },
      { emoji: '😏', name: 'smirking face', keywords: ['smirk'] },
      { emoji: '😒', name: 'unamused face', keywords: ['meh'] },
      { emoji: '🙄', name: 'face with rolling eyes', keywords: ['eyeroll'] },
      { emoji: '😬', name: 'grimacing face', keywords: ['awkward'] },
      { emoji: '🤥', name: 'lying face', keywords: ['pinocchio'] },
      { emoji: '😌', name: 'relieved face', keywords: ['relief', 'content'] },
      { emoji: '😔', name: 'pensive face', keywords: ['sad', 'thoughtful'] },
      { emoji: '😪', name: 'sleepy face', keywords: ['tired'] },
      { emoji: '🤤', name: 'drooling face', keywords: ['drool'] },
      { emoji: '😴', name: 'sleeping face', keywords: ['zzz', 'sleep'] },
      { emoji: '😷', name: 'face with medical mask', keywords: ['sick', 'mask'] },
      { emoji: '🤒', name: 'face with thermometer', keywords: ['sick', 'fever'] },
      { emoji: '🤕', name: 'face with head-bandage', keywords: ['hurt'] },
      { emoji: '🤢', name: 'nauseated face', keywords: ['sick', 'green'] },
      { emoji: '🤮', name: 'face vomiting', keywords: ['sick', 'throw up'] },
      { emoji: '🥵', name: 'hot face', keywords: ['hot', 'sweat'] },
      { emoji: '🥶', name: 'cold face', keywords: ['cold', 'frozen'] },
      { emoji: '🥴', name: 'woozy face', keywords: ['dizzy', 'drunk'] },
      { emoji: '😵', name: 'face with crossed-out eyes', keywords: ['dizzy'] },
      { emoji: '🤯', name: 'exploding head', keywords: ['mind blown', 'shocked'] },
      { emoji: '🤠', name: 'cowboy hat face', keywords: ['cowboy'] },
      { emoji: '🥳', name: 'partying face', keywords: ['party', 'celebrate'] },
      { emoji: '🥸', name: 'disguised face', keywords: ['disguise'] },
      { emoji: '😎', name: 'smiling face with sunglasses', keywords: ['cool'] },
      { emoji: '🤓', name: 'nerd face', keywords: ['nerd', 'glasses'] },
      { emoji: '🧐', name: 'face with monocle', keywords: ['fancy', 'inspect'] },
      { emoji: '😕', name: 'confused face', keywords: ['confused'] },
      { emoji: '🫤', name: 'face with diagonal mouth', keywords: ['unsure'] },
      { emoji: '😟', name: 'worried face', keywords: ['worry'] },
      { emoji: '🙁', name: 'slightly frowning face', keywords: ['sad'] },
      { emoji: '😮', name: 'face with open mouth', keywords: ['surprised'] },
      { emoji: '😯', name: 'hushed face', keywords: ['surprised'] },
      { emoji: '😲', name: 'astonished face', keywords: ['shocked'] },
      { emoji: '😳', name: 'flushed face', keywords: ['embarrassed'] },
      { emoji: '🥺', name: 'pleading face', keywords: ['please', 'puppy eyes'] },
      { emoji: '🥹', name: 'face holding back tears', keywords: ['emotional'] },
      { emoji: '😦', name: 'frowning face with open mouth', keywords: ['aw'] },
      { emoji: '😧', name: 'anguished face', keywords: ['pain'] },
      { emoji: '😨', name: 'fearful face', keywords: ['scared'] },
      { emoji: '😰', name: 'anxious face with sweat', keywords: ['nervous'] },
      { emoji: '😥', name: 'sad but relieved face', keywords: ['phew'] },
      { emoji: '😢', name: 'crying face', keywords: ['cry', 'sad'] },
      { emoji: '😭', name: 'loudly crying face', keywords: ['sob', 'cry'] },
      { emoji: '😱', name: 'face screaming in fear', keywords: ['scream'] },
      { emoji: '😖', name: 'confounded face', keywords: ['frustrated'] },
      { emoji: '😣', name: 'persevering face', keywords: ['struggle'] },
      { emoji: '😞', name: 'disappointed face', keywords: ['sad'] },
      { emoji: '😓', name: 'downcast face with sweat', keywords: ['hard work'] },
      { emoji: '😩', name: 'weary face', keywords: ['tired'] },
      { emoji: '😫', name: 'tired face', keywords: ['exhausted'] },
      { emoji: '🥱', name: 'yawning face', keywords: ['yawn', 'bored'] },
      { emoji: '😤', name: 'face with steam from nose', keywords: ['angry', 'triumph'] },
      { emoji: '😡', name: 'pouting face', keywords: ['angry', 'rage'] },
      { emoji: '😠', name: 'angry face', keywords: ['angry', 'mad'] },
      { emoji: '🤬', name: 'face with symbols on mouth', keywords: ['swear'] },
      { emoji: '😈', name: 'smiling face with horns', keywords: ['devil'] },
      { emoji: '👿', name: 'angry face with horns', keywords: ['devil'] },
      { emoji: '💀', name: 'skull', keywords: ['dead', 'death'] },
      { emoji: '☠️', name: 'skull and crossbones', keywords: ['danger'] },
      { emoji: '💩', name: 'pile of poo', keywords: ['poop'] },
      { emoji: '🤡', name: 'clown face', keywords: ['clown'] },
      { emoji: '👹', name: 'ogre', keywords: ['monster'] },
      { emoji: '👺', name: 'goblin', keywords: ['monster'] },
      { emoji: '👻', name: 'ghost', keywords: ['halloween'] },
      { emoji: '👽', name: 'alien', keywords: ['ufo'] },
      { emoji: '👾', name: 'alien monster', keywords: ['game', 'space invader'] },
      { emoji: '🤖', name: 'robot', keywords: ['bot'] },
      { emoji: '😺', name: 'grinning cat', keywords: ['cat', 'happy'] },
      { emoji: '😸', name: 'grinning cat with smiling eyes' },
      { emoji: '😹', name: 'cat with tears of joy' },
      { emoji: '😻', name: 'smiling cat with heart-eyes' },
      { emoji: '😼', name: 'cat with wry smile' },
      { emoji: '😽', name: 'kissing cat' },
      { emoji: '🙀', name: 'weary cat' },
      { emoji: '😿', name: 'crying cat' },
      { emoji: '😾', name: 'pouting cat' },
      { emoji: '👋', name: 'waving hand', keywords: ['wave', 'hello', 'bye'] },
      { emoji: '🤚', name: 'raised back of hand' },
      { emoji: '🖐️', name: 'hand with fingers splayed' },
      { emoji: '✋', name: 'raised hand', keywords: ['stop', 'high five'] },
      { emoji: '🖖', name: 'vulcan salute', keywords: ['spock'] },
      { emoji: '👌', name: 'OK hand', keywords: ['ok', 'perfect'] },
      { emoji: '🤌', name: 'pinched fingers', keywords: ['italian'] },
      { emoji: '🤏', name: 'pinching hand', keywords: ['small'] },
      { emoji: '✌️', name: 'victory hand', keywords: ['peace'] },
      { emoji: '🤞', name: 'crossed fingers', keywords: ['luck'] },
      { emoji: '🫰', name: 'hand with index finger and thumb crossed' },
      { emoji: '🤟', name: 'love-you gesture', keywords: ['love'] },
      { emoji: '🤘', name: 'sign of the horns', keywords: ['rock'] },
      { emoji: '🤙', name: 'call me hand', keywords: ['call'] },
      { emoji: '👈', name: 'backhand index pointing left', keywords: ['left'] },
      { emoji: '👉', name: 'backhand index pointing right', keywords: ['right'] },
      { emoji: '👆', name: 'backhand index pointing up', keywords: ['up'] },
      { emoji: '🖕', name: 'middle finger', keywords: ['flip off'] },
      { emoji: '👇', name: 'backhand index pointing down', keywords: ['down'] },
      { emoji: '☝️', name: 'index pointing up', keywords: ['up'] },
      { emoji: '🫵', name: 'index pointing at the viewer', keywords: ['you'] },
      { emoji: '👍', name: 'thumbs up', keywords: ['like', 'yes', 'good'] },
      { emoji: '👎', name: 'thumbs down', keywords: ['dislike', 'no', 'bad'] },
      { emoji: '✊', name: 'raised fist', keywords: ['power'] },
      { emoji: '👊', name: 'oncoming fist', keywords: ['punch'] },
      { emoji: '🤛', name: 'left-facing fist' },
      { emoji: '🤜', name: 'right-facing fist' },
      { emoji: '👏', name: 'clapping hands', keywords: ['clap', 'applause'] },
      { emoji: '🙌', name: 'raising hands', keywords: ['hooray'] },
      { emoji: '🫶', name: 'heart hands', keywords: ['love'] },
      { emoji: '👐', name: 'open hands' },
      { emoji: '🤲', name: 'palms up together' },
      { emoji: '🤝', name: 'handshake', keywords: ['deal', 'agree'] },
      { emoji: '🙏', name: 'folded hands', keywords: ['pray', 'please', 'thanks'] },
      { emoji: '💪', name: 'flexed biceps', keywords: ['strong', 'muscle'] },
      { emoji: '❤️', name: 'red heart', keywords: ['love'] },
      { emoji: '🧡', name: 'orange heart' },
      { emoji: '💛', name: 'yellow heart' },
      { emoji: '💚', name: 'green heart' },
      { emoji: '💙', name: 'blue heart' },
      { emoji: '💜', name: 'purple heart' },
      { emoji: '🖤', name: 'black heart' },
      { emoji: '🤍', name: 'white heart' },
      { emoji: '🤎', name: 'brown heart' },
      { emoji: '💔', name: 'broken heart', keywords: ['sad'] },
      { emoji: '❤️‍🔥', name: 'heart on fire' },
      { emoji: '💯', name: 'hundred points', keywords: ['100', 'perfect'] },
      { emoji: '💢', name: 'anger symbol' },
      { emoji: '💥', name: 'collision', keywords: ['boom', 'explosion'] },
      { emoji: '💫', name: 'dizzy', keywords: ['star'] },
      { emoji: '💬', name: 'speech balloon', keywords: ['chat', 'message'] },
      { emoji: '💤', name: 'zzz', keywords: ['sleep'] },
    ],
  },
  {
    id: 'nature',
    name: 'Animals & Nature',
    icon: <Dog size={16} />,
    emojis: [
      { emoji: '🐶', name: 'dog face', keywords: ['dog', 'puppy'] },
      { emoji: '🐱', name: 'cat face', keywords: ['cat', 'kitty'] },
      { emoji: '🐭', name: 'mouse face', keywords: ['mouse'] },
      { emoji: '🐹', name: 'hamster', keywords: ['hamster'] },
      { emoji: '🐰', name: 'rabbit face', keywords: ['bunny'] },
      { emoji: '🦊', name: 'fox', keywords: ['fox'] },
      { emoji: '🐻', name: 'bear', keywords: ['bear'] },
      { emoji: '🐼', name: 'panda', keywords: ['panda'] },
      { emoji: '🐻‍❄️', name: 'polar bear', keywords: ['arctic'] },
      { emoji: '🐨', name: 'koala', keywords: ['koala'] },
      { emoji: '🐯', name: 'tiger face', keywords: ['tiger'] },
      { emoji: '🦁', name: 'lion', keywords: ['lion'] },
      { emoji: '🐮', name: 'cow face', keywords: ['cow'] },
      { emoji: '🐷', name: 'pig face', keywords: ['pig'] },
      { emoji: '🐸', name: 'frog', keywords: ['frog'] },
      { emoji: '🐵', name: 'monkey face', keywords: ['monkey'] },
      { emoji: '🙈', name: 'see-no-evil monkey', keywords: ['hide'] },
      { emoji: '🙉', name: 'hear-no-evil monkey' },
      { emoji: '🙊', name: 'speak-no-evil monkey' },
      { emoji: '🐔', name: 'chicken', keywords: ['chicken'] },
      { emoji: '🐧', name: 'penguin', keywords: ['penguin'] },
      { emoji: '🐦', name: 'bird', keywords: ['bird'] },
      { emoji: '🐤', name: 'baby chick', keywords: ['chick'] },
      { emoji: '🦆', name: 'duck', keywords: ['duck'] },
      { emoji: '🦅', name: 'eagle', keywords: ['eagle'] },
      { emoji: '🦉', name: 'owl', keywords: ['owl', 'wise'] },
      { emoji: '🦇', name: 'bat', keywords: ['bat'] },
      { emoji: '🐺', name: 'wolf', keywords: ['wolf'] },
      { emoji: '🐗', name: 'boar' },
      { emoji: '🐴', name: 'horse face', keywords: ['horse'] },
      { emoji: '🦄', name: 'unicorn', keywords: ['unicorn', 'magic'] },
      { emoji: '🐝', name: 'honeybee', keywords: ['bee'] },
      { emoji: '🪱', name: 'worm' },
      { emoji: '🐛', name: 'bug', keywords: ['bug', 'insect'] },
      { emoji: '🦋', name: 'butterfly', keywords: ['butterfly'] },
      { emoji: '🐌', name: 'snail', keywords: ['slow'] },
      { emoji: '🐞', name: 'lady beetle', keywords: ['ladybug'] },
      { emoji: '🐜', name: 'ant', keywords: ['ant'] },
      { emoji: '🐢', name: 'turtle', keywords: ['turtle', 'slow'] },
      { emoji: '🐍', name: 'snake', keywords: ['snake'] },
      { emoji: '🦎', name: 'lizard' },
      { emoji: '🦂', name: 'scorpion' },
      { emoji: '🦑', name: 'squid' },
      { emoji: '🐙', name: 'octopus', keywords: ['octopus'] },
      { emoji: '🐠', name: 'tropical fish', keywords: ['fish'] },
      { emoji: '🐟', name: 'fish', keywords: ['fish'] },
      { emoji: '🐡', name: 'blowfish' },
      { emoji: '🐬', name: 'dolphin', keywords: ['dolphin'] },
      { emoji: '🐳', name: 'spouting whale', keywords: ['whale'] },
      { emoji: '🐋', name: 'whale' },
      { emoji: '🦈', name: 'shark', keywords: ['shark'] },
      { emoji: '🐊', name: 'crocodile' },
      { emoji: '🐅', name: 'tiger' },
      { emoji: '🌸', name: 'cherry blossom', keywords: ['flower', 'spring'] },
      { emoji: '🌹', name: 'rose', keywords: ['flower', 'romance'] },
      { emoji: '🌺', name: 'hibiscus', keywords: ['flower'] },
      { emoji: '🌻', name: 'sunflower', keywords: ['flower'] },
      { emoji: '🌼', name: 'blossom', keywords: ['flower'] },
      { emoji: '🌷', name: 'tulip', keywords: ['flower'] },
      { emoji: '🌱', name: 'seedling', keywords: ['plant', 'grow'] },
      { emoji: '🪴', name: 'potted plant', keywords: ['plant'] },
      { emoji: '🌲', name: 'evergreen tree', keywords: ['tree'] },
      { emoji: '🌳', name: 'deciduous tree', keywords: ['tree'] },
      { emoji: '🌴', name: 'palm tree', keywords: ['tropical'] },
      { emoji: '🌵', name: 'cactus', keywords: ['desert'] },
      { emoji: '🍀', name: 'four leaf clover', keywords: ['luck', 'clover'] },
      { emoji: '🍁', name: 'maple leaf', keywords: ['fall', 'autumn'] },
      { emoji: '🍄', name: 'mushroom', keywords: ['mushroom'] },
      { emoji: '🌾', name: 'sheaf of rice' },
      { emoji: '🔥', name: 'fire', keywords: ['lit', 'hot', 'flame'] },
      { emoji: '🌊', name: 'water wave', keywords: ['wave', 'ocean'] },
      { emoji: '💧', name: 'droplet', keywords: ['water'] },
      { emoji: '⭐', name: 'star', keywords: ['star'] },
      { emoji: '🌟', name: 'glowing star', keywords: ['star', 'sparkle'] },
      { emoji: '✨', name: 'sparkles', keywords: ['sparkle', 'magic'] },
      { emoji: '⚡', name: 'high voltage', keywords: ['lightning', 'zap'] },
      { emoji: '☀️', name: 'sun', keywords: ['sun', 'sunny'] },
      { emoji: '🌙', name: 'crescent moon', keywords: ['moon', 'night'] },
      { emoji: '🌈', name: 'rainbow', keywords: ['rainbow'] },
      { emoji: '☁️', name: 'cloud', keywords: ['cloud'] },
      { emoji: '❄️', name: 'snowflake', keywords: ['cold', 'winter'] },
    ],
  },
  {
    id: 'food',
    name: 'Food & Drink',
    icon: <Coffee size={16} />,
    emojis: [
      { emoji: '🍎', name: 'red apple', keywords: ['apple', 'fruit'] },
      { emoji: '🍐', name: 'pear', keywords: ['fruit'] },
      { emoji: '🍊', name: 'tangerine', keywords: ['orange', 'fruit'] },
      { emoji: '🍋', name: 'lemon', keywords: ['fruit'] },
      { emoji: '🍌', name: 'banana', keywords: ['fruit'] },
      { emoji: '🍉', name: 'watermelon', keywords: ['fruit', 'summer'] },
      { emoji: '🍇', name: 'grapes', keywords: ['fruit'] },
      { emoji: '🍓', name: 'strawberry', keywords: ['fruit'] },
      { emoji: '🫐', name: 'blueberries', keywords: ['fruit'] },
      { emoji: '🍑', name: 'peach', keywords: ['fruit'] },
      { emoji: '🥭', name: 'mango', keywords: ['fruit'] },
      { emoji: '🍍', name: 'pineapple', keywords: ['fruit'] },
      { emoji: '🥥', name: 'coconut', keywords: ['fruit'] },
      { emoji: '🥝', name: 'kiwi fruit', keywords: ['fruit'] },
      { emoji: '🍅', name: 'tomato', keywords: ['vegetable'] },
      { emoji: '🥑', name: 'avocado', keywords: ['fruit'] },
      { emoji: '🌽', name: 'ear of corn', keywords: ['corn'] },
      { emoji: '🌶️', name: 'hot pepper', keywords: ['spicy'] },
      { emoji: '🥒', name: 'cucumber' },
      { emoji: '🥦', name: 'broccoli' },
      { emoji: '🧄', name: 'garlic' },
      { emoji: '🧅', name: 'onion' },
      { emoji: '🥕', name: 'carrot' },
      { emoji: '🍞', name: 'bread', keywords: ['bread'] },
      { emoji: '🥐', name: 'croissant', keywords: ['pastry'] },
      { emoji: '🥖', name: 'baguette bread' },
      { emoji: '🧀', name: 'cheese', keywords: ['cheese'] },
      { emoji: '🍖', name: 'meat on bone', keywords: ['meat'] },
      { emoji: '🍗', name: 'poultry leg', keywords: ['chicken'] },
      { emoji: '🥩', name: 'cut of meat', keywords: ['steak'] },
      { emoji: '🌭', name: 'hot dog', keywords: ['hotdog'] },
      { emoji: '🍔', name: 'hamburger', keywords: ['burger'] },
      { emoji: '🍟', name: 'french fries', keywords: ['fries'] },
      { emoji: '🍕', name: 'pizza', keywords: ['pizza'] },
      { emoji: '🌮', name: 'taco', keywords: ['taco'] },
      { emoji: '🌯', name: 'burrito', keywords: ['wrap'] },
      { emoji: '🥗', name: 'green salad', keywords: ['salad'] },
      { emoji: '🍜', name: 'steaming bowl', keywords: ['noodles', 'ramen'] },
      { emoji: '🍝', name: 'spaghetti', keywords: ['pasta'] },
      { emoji: '🍣', name: 'sushi', keywords: ['sushi'] },
      { emoji: '🍤', name: 'fried shrimp', keywords: ['shrimp'] },
      { emoji: '🍩', name: 'doughnut', keywords: ['donut'] },
      { emoji: '🍪', name: 'cookie', keywords: ['cookie'] },
      { emoji: '🎂', name: 'birthday cake', keywords: ['cake', 'birthday'] },
      { emoji: '🍰', name: 'shortcake', keywords: ['cake'] },
      { emoji: '🧁', name: 'cupcake', keywords: ['cake'] },
      { emoji: '🍫', name: 'chocolate bar', keywords: ['chocolate'] },
      { emoji: '🍬', name: 'candy', keywords: ['candy'] },
      { emoji: '🍭', name: 'lollipop', keywords: ['candy'] },
      { emoji: '🍮', name: 'custard', keywords: ['pudding'] },
      { emoji: '🍦', name: 'soft ice cream', keywords: ['ice cream'] },
      { emoji: '🍧', name: 'shaved ice' },
      { emoji: '🍨', name: 'ice cream', keywords: ['ice cream'] },
      { emoji: '☕', name: 'hot beverage', keywords: ['coffee', 'tea'] },
      { emoji: '🍵', name: 'teacup without handle', keywords: ['tea'] },
      { emoji: '🧃', name: 'beverage box', keywords: ['juice'] },
      { emoji: '🥤', name: 'cup with straw', keywords: ['soda'] },
      { emoji: '🧋', name: 'bubble tea', keywords: ['boba'] },
      { emoji: '🍺', name: 'beer mug', keywords: ['beer'] },
      { emoji: '🍻', name: 'clinking beer mugs', keywords: ['cheers'] },
      { emoji: '🥂', name: 'clinking glasses', keywords: ['champagne', 'cheers'] },
      { emoji: '🍷', name: 'wine glass', keywords: ['wine'] },
      { emoji: '🥃', name: 'tumbler glass', keywords: ['whiskey'] },
      { emoji: '🍸', name: 'cocktail glass', keywords: ['cocktail'] },
      { emoji: '🧊', name: 'ice', keywords: ['ice', 'cold'] },
    ],
  },
  {
    id: 'travel',
    name: 'Travel & Places',
    icon: <Plane size={16} />,
    emojis: [
      { emoji: '🚗', name: 'automobile', keywords: ['car'] },
      { emoji: '🚕', name: 'taxi', keywords: ['taxi'] },
      { emoji: '🚙', name: 'sport utility vehicle', keywords: ['suv'] },
      { emoji: '🚌', name: 'bus', keywords: ['bus'] },
      { emoji: '🚎', name: 'trolleybus' },
      { emoji: '🏎️', name: 'racing car', keywords: ['fast'] },
      { emoji: '🚓', name: 'police car', keywords: ['police'] },
      { emoji: '🚑', name: 'ambulance', keywords: ['emergency'] },
      { emoji: '🚒', name: 'fire engine', keywords: ['fire'] },
      { emoji: '🚐', name: 'minibus' },
      { emoji: '🛻', name: 'pickup truck' },
      { emoji: '🚚', name: 'delivery truck' },
      { emoji: '🚛', name: 'articulated lorry' },
      { emoji: '🚲', name: 'bicycle', keywords: ['bike'] },
      { emoji: '🛵', name: 'motor scooter' },
      { emoji: '🏍️', name: 'motorcycle', keywords: ['motorcycle'] },
      { emoji: '✈️', name: 'airplane', keywords: ['plane', 'travel'] },
      { emoji: '🚀', name: 'rocket', keywords: ['launch', 'space'] },
      { emoji: '🛸', name: 'flying saucer', keywords: ['ufo'] },
      { emoji: '🚁', name: 'helicopter' },
      { emoji: '🛶', name: 'canoe' },
      { emoji: '⛵', name: 'sailboat', keywords: ['boat'] },
      { emoji: '🚢', name: 'ship', keywords: ['boat'] },
      { emoji: '🚂', name: 'locomotive', keywords: ['train'] },
      { emoji: '🚃', name: 'railway car' },
      { emoji: '🚄', name: 'high-speed train', keywords: ['fast'] },
      { emoji: '🏠', name: 'house', keywords: ['home'] },
      { emoji: '🏡', name: 'house with garden', keywords: ['home'] },
      { emoji: '🏢', name: 'office building', keywords: ['office', 'work'] },
      { emoji: '🏣', name: 'Japanese post office' },
      { emoji: '🏥', name: 'hospital', keywords: ['hospital'] },
      { emoji: '🏦', name: 'bank', keywords: ['bank'] },
      { emoji: '🏪', name: 'convenience store', keywords: ['shop'] },
      { emoji: '🏫', name: 'school', keywords: ['school'] },
      { emoji: '🏰', name: 'castle', keywords: ['castle'] },
      { emoji: '🗼', name: 'Tokyo tower' },
      { emoji: '🗽', name: 'Statue of Liberty' },
      { emoji: '⛪', name: 'church' },
      { emoji: '🕌', name: 'mosque' },
      { emoji: '🛕', name: 'hindu temple' },
      { emoji: '🗻', name: 'mount fuji', keywords: ['mountain'] },
      { emoji: '🏝️', name: 'desert island', keywords: ['island'] },
      { emoji: '🏖️', name: 'beach', keywords: ['beach', 'vacation'] },
      { emoji: '🌍', name: 'globe showing Europe-Africa', keywords: ['earth', 'world'] },
      { emoji: '🌎', name: 'globe showing Americas', keywords: ['earth', 'world'] },
      { emoji: '🌏', name: 'globe showing Asia-Australia', keywords: ['earth', 'world'] },
      { emoji: '🗺️', name: 'world map', keywords: ['map'] },
    ],
  },
  {
    id: 'activities',
    name: 'Activities',
    icon: <Gamepad2 size={16} />,
    emojis: [
      { emoji: '⚽', name: 'soccer ball', keywords: ['football', 'soccer'] },
      { emoji: '🏀', name: 'basketball', keywords: ['basketball'] },
      { emoji: '🏈', name: 'american football', keywords: ['football'] },
      { emoji: '⚾', name: 'baseball', keywords: ['baseball'] },
      { emoji: '🥎', name: 'softball' },
      { emoji: '🎾', name: 'tennis', keywords: ['tennis'] },
      { emoji: '🏐', name: 'volleyball' },
      { emoji: '🏉', name: 'rugby football' },
      { emoji: '🥏', name: 'flying disc', keywords: ['frisbee'] },
      { emoji: '🎱', name: 'pool 8 ball', keywords: ['billiards'] },
      { emoji: '🏓', name: 'ping pong', keywords: ['table tennis'] },
      { emoji: '🏸', name: 'badminton' },
      { emoji: '🏒', name: 'ice hockey' },
      { emoji: '🥊', name: 'boxing glove', keywords: ['boxing'] },
      { emoji: '🎯', name: 'direct hit', keywords: ['target', 'bullseye'] },
      { emoji: '⛳', name: 'flag in hole', keywords: ['golf'] },
      { emoji: '🎮', name: 'video game', keywords: ['game', 'controller'] },
      { emoji: '🕹️', name: 'joystick', keywords: ['game', 'arcade'] },
      { emoji: '🎲', name: 'game die', keywords: ['dice', 'random'] },
      { emoji: '🧩', name: 'puzzle piece', keywords: ['puzzle'] },
      { emoji: '♟️', name: 'chess pawn', keywords: ['chess'] },
      { emoji: '🎭', name: 'performing arts', keywords: ['theater', 'drama'] },
      { emoji: '🎨', name: 'artist palette', keywords: ['art', 'paint'] },
      { emoji: '🎬', name: 'clapper board', keywords: ['movie', 'film'] },
      { emoji: '🎤', name: 'microphone', keywords: ['karaoke', 'singing'] },
      { emoji: '🎧', name: 'headphone', keywords: ['music', 'headphones'] },
      { emoji: '🎼', name: 'musical score', keywords: ['music'] },
      { emoji: '🎹', name: 'musical keyboard', keywords: ['piano'] },
      { emoji: '🥁', name: 'drum', keywords: ['drums'] },
      { emoji: '🎷', name: 'saxophone', keywords: ['sax', 'jazz'] },
      { emoji: '🎺', name: 'trumpet', keywords: ['trumpet'] },
      { emoji: '🎸', name: 'guitar', keywords: ['rock'] },
      { emoji: '🎻', name: 'violin', keywords: ['violin'] },
      { emoji: '🎪', name: 'circus tent', keywords: ['circus'] },
      { emoji: '🎟️', name: 'admission tickets', keywords: ['ticket'] },
      { emoji: '🏆', name: 'trophy', keywords: ['win', 'award'] },
      { emoji: '🥇', name: 'gold medal', keywords: ['first', 'winner'] },
      { emoji: '🥈', name: 'silver medal', keywords: ['second'] },
      { emoji: '🥉', name: 'bronze medal', keywords: ['third'] },
      { emoji: '🏅', name: 'sports medal', keywords: ['medal'] },
      { emoji: '🎖️', name: 'military medal' },
      { emoji: '🎗️', name: 'reminder ribbon' },
      { emoji: '🎀', name: 'ribbon', keywords: ['bow'] },
      { emoji: '🎁', name: 'wrapped gift', keywords: ['present', 'gift'] },
      { emoji: '🎉', name: 'party popper', keywords: ['party', 'celebrate'] },
      { emoji: '🎊', name: 'confetti ball', keywords: ['party'] },
      { emoji: '🎈', name: 'balloon', keywords: ['party'] },
      { emoji: '🎆', name: 'fireworks', keywords: ['celebrate'] },
      { emoji: '🎇', name: 'sparkler', keywords: ['firework'] },
      { emoji: '🧨', name: 'firecracker' },
    ],
  },
  {
    id: 'objects',
    name: 'Objects',
    icon: <Lightbulb size={16} />,
    emojis: [
      { emoji: '⌚', name: 'watch', keywords: ['time'] },
      { emoji: '📱', name: 'mobile phone', keywords: ['phone', 'cell'] },
      { emoji: '💻', name: 'laptop', keywords: ['computer'] },
      { emoji: '⌨️', name: 'keyboard', keywords: ['type'] },
      { emoji: '🖥️', name: 'desktop computer', keywords: ['pc'] },
      { emoji: '🖨️', name: 'printer' },
      { emoji: '🖱️', name: 'computer mouse' },
      { emoji: '💽', name: 'computer disk' },
      { emoji: '💾', name: 'floppy disk', keywords: ['save'] },
      { emoji: '💿', name: 'optical disk', keywords: ['cd'] },
      { emoji: '📀', name: 'dvd' },
      { emoji: '📷', name: 'camera', keywords: ['photo'] },
      { emoji: '📹', name: 'video camera', keywords: ['video'] },
      { emoji: '🎥', name: 'movie camera', keywords: ['film'] },
      { emoji: '📺', name: 'television', keywords: ['tv'] },
      { emoji: '📻', name: 'radio' },
      { emoji: '🔔', name: 'bell', keywords: ['notification'] },
      { emoji: '🔕', name: 'bell with slash', keywords: ['mute'] },
      { emoji: '📢', name: 'loudspeaker', keywords: ['announcement'] },
      { emoji: '📣', name: 'megaphone', keywords: ['loud'] },
      { emoji: '💡', name: 'light bulb', keywords: ['idea'] },
      { emoji: '🔦', name: 'flashlight' },
      { emoji: '🕯️', name: 'candle', keywords: ['candle'] },
      { emoji: '📚', name: 'books', keywords: ['library', 'read'] },
      { emoji: '📖', name: 'open book', keywords: ['book', 'read'] },
      { emoji: '📝', name: 'memo', keywords: ['note', 'write'] },
      { emoji: '✏️', name: 'pencil', keywords: ['write', 'edit'] },
      { emoji: '🖊️', name: 'pen' },
      { emoji: '📎', name: 'paperclip', keywords: ['attachment'] },
      { emoji: '📌', name: 'pushpin', keywords: ['pin'] },
      { emoji: '📍', name: 'round pushpin', keywords: ['location'] },
      { emoji: '🔑', name: 'key', keywords: ['key', 'password'] },
      { emoji: '🗝️', name: 'old key' },
      { emoji: '🔒', name: 'locked', keywords: ['lock', 'secure'] },
      { emoji: '🔓', name: 'unlocked' },
      { emoji: '🛡️', name: 'shield', keywords: ['security'] },
      { emoji: '🔧', name: 'wrench', keywords: ['tool', 'fix'] },
      { emoji: '🔨', name: 'hammer', keywords: ['tool', 'build'] },
      { emoji: '⚙️', name: 'gear', keywords: ['settings', 'config'] },
      { emoji: '🧲', name: 'magnet' },
      { emoji: '💣', name: 'bomb', keywords: ['boom'] },
      { emoji: '🧪', name: 'test tube', keywords: ['science', 'experiment'] },
      { emoji: '🧬', name: 'dna', keywords: ['science'] },
      { emoji: '🔬', name: 'microscope', keywords: ['science'] },
      { emoji: '🔭', name: 'telescope', keywords: ['space'] },
      { emoji: '💊', name: 'pill', keywords: ['medicine'] },
      { emoji: '💉', name: 'syringe', keywords: ['vaccine'] },
      { emoji: '🩹', name: 'adhesive bandage', keywords: ['bandaid'] },
      { emoji: '🏷️', name: 'label', keywords: ['tag'] },
    ],
  },
  {
    id: 'symbols',
    name: 'Symbols',
    icon: <Hash size={16} />,
    emojis: [
      { emoji: '❤️', name: 'red heart', keywords: ['love'] },
      { emoji: '💕', name: 'two hearts', keywords: ['love'] },
      { emoji: '💞', name: 'revolving hearts', keywords: ['love'] },
      { emoji: '💓', name: 'beating heart' },
      { emoji: '💗', name: 'growing heart' },
      { emoji: '💖', name: 'sparkling heart' },
      { emoji: '💘', name: 'heart with arrow', keywords: ['cupid'] },
      { emoji: '💝', name: 'heart with ribbon' },
      { emoji: '✅', name: 'check mark button', keywords: ['yes', 'done'] },
      { emoji: '❌', name: 'cross mark', keywords: ['no', 'wrong'] },
      { emoji: '⭕', name: 'hollow red circle' },
      { emoji: '❗', name: 'exclamation mark', keywords: ['important'] },
      { emoji: '❓', name: 'question mark', keywords: ['what'] },
      { emoji: '‼️', name: 'double exclamation mark' },
      { emoji: '⁉️', name: 'exclamation question mark' },
      { emoji: '💤', name: 'zzz', keywords: ['sleep'] },
      { emoji: '💬', name: 'speech balloon', keywords: ['chat'] },
      { emoji: '💭', name: 'thought balloon', keywords: ['think'] },
      { emoji: '🔴', name: 'red circle', keywords: ['red'] },
      { emoji: '🟠', name: 'orange circle', keywords: ['orange'] },
      { emoji: '🟡', name: 'yellow circle', keywords: ['yellow'] },
      { emoji: '🟢', name: 'green circle', keywords: ['green'] },
      { emoji: '🔵', name: 'blue circle', keywords: ['blue'] },
      { emoji: '🟣', name: 'purple circle', keywords: ['purple'] },
      { emoji: '⚫', name: 'black circle', keywords: ['black'] },
      { emoji: '⚪', name: 'white circle', keywords: ['white'] },
      { emoji: '🟤', name: 'brown circle', keywords: ['brown'] },
      { emoji: '🔺', name: 'red triangle pointed up' },
      { emoji: '🔻', name: 'red triangle pointed down' },
      { emoji: '🔶', name: 'large orange diamond' },
      { emoji: '🔷', name: 'large blue diamond' },
      { emoji: '➕', name: 'plus', keywords: ['add'] },
      { emoji: '➖', name: 'minus', keywords: ['subtract'] },
      { emoji: '➗', name: 'divide' },
      { emoji: '✖️', name: 'multiply' },
      { emoji: '♻️', name: 'recycling symbol', keywords: ['recycle'] },
      { emoji: '♾️', name: 'infinity', keywords: ['infinite'] },
      { emoji: '🔀', name: 'shuffle tracks button', keywords: ['random'] },
      { emoji: '🔁', name: 'repeat button', keywords: ['loop'] },
      { emoji: '▶️', name: 'play button', keywords: ['play'] },
      { emoji: '⏸️', name: 'pause button', keywords: ['pause'] },
      { emoji: '⏹️', name: 'stop button', keywords: ['stop'] },
      { emoji: '⏩', name: 'fast-forward button', keywords: ['forward'] },
      { emoji: '⏪', name: 'fast reverse button', keywords: ['rewind'] },
      { emoji: '🔊', name: 'speaker high volume', keywords: ['loud'] },
      { emoji: '🔇', name: 'muted speaker', keywords: ['mute'] },
      { emoji: '📶', name: 'antenna bars', keywords: ['signal'] },
      { emoji: '🔋', name: 'battery', keywords: ['battery'] },
      { emoji: '🏁', name: 'chequered flag', keywords: ['finish'] },
    ],
  },
  {
    id: 'flags',
    name: 'Flags',
    icon: <Flag size={16} />,
    emojis: [
      { emoji: '🏳️', name: 'white flag' },
      { emoji: '🏴', name: 'black flag' },
      { emoji: '🏳️‍🌈', name: 'rainbow flag', keywords: ['pride', 'lgbtq'] },
      { emoji: '🏳️‍⚧️', name: 'transgender flag' },
      { emoji: '🏴‍☠️', name: 'pirate flag', keywords: ['pirate'] },
      { emoji: '🇺🇸', name: 'United States', keywords: ['usa', 'america'] },
      { emoji: '🇬🇧', name: 'United Kingdom', keywords: ['uk', 'britain'] },
      { emoji: '🇫🇷', name: 'France', keywords: ['france'] },
      { emoji: '🇩🇪', name: 'Germany', keywords: ['germany'] },
      { emoji: '🇮🇹', name: 'Italy', keywords: ['italy'] },
      { emoji: '🇪🇸', name: 'Spain', keywords: ['spain'] },
      { emoji: '🇵🇹', name: 'Portugal', keywords: ['portugal'] },
      { emoji: '🇧🇷', name: 'Brazil', keywords: ['brazil'] },
      { emoji: '🇨🇦', name: 'Canada', keywords: ['canada'] },
      { emoji: '🇦🇺', name: 'Australia', keywords: ['australia'] },
      { emoji: '🇯🇵', name: 'Japan', keywords: ['japan'] },
      { emoji: '🇰🇷', name: 'South Korea', keywords: ['korea'] },
      { emoji: '🇨🇳', name: 'China', keywords: ['china'] },
      { emoji: '🇮🇳', name: 'India', keywords: ['india'] },
      { emoji: '🇷🇺', name: 'Russia', keywords: ['russia'] },
      { emoji: '🇹🇷', name: 'Turkey', keywords: ['turkey'] },
      { emoji: '🇳🇱', name: 'Netherlands', keywords: ['dutch'] },
      { emoji: '🇸🇪', name: 'Sweden', keywords: ['sweden'] },
      { emoji: '🇳🇴', name: 'Norway', keywords: ['norway'] },
      { emoji: '🇩🇰', name: 'Denmark', keywords: ['denmark'] },
      { emoji: '🇫🇮', name: 'Finland', keywords: ['finland'] },
      { emoji: '🇵🇱', name: 'Poland', keywords: ['poland'] },
      { emoji: '🇨🇭', name: 'Switzerland', keywords: ['swiss'] },
      { emoji: '🇦🇹', name: 'Austria', keywords: ['austria'] },
      { emoji: '🇲🇽', name: 'Mexico', keywords: ['mexico'] },
      { emoji: '🇦🇷', name: 'Argentina', keywords: ['argentina'] },
      { emoji: '🇨🇴', name: 'Colombia', keywords: ['colombia'] },
      { emoji: '🇿🇦', name: 'South Africa', keywords: ['south africa'] },
      { emoji: '🇪🇬', name: 'Egypt', keywords: ['egypt'] },
      { emoji: '🇳🇬', name: 'Nigeria', keywords: ['nigeria'] },
      { emoji: '🇹🇭', name: 'Thailand', keywords: ['thailand'] },
      { emoji: '🇻🇳', name: 'Vietnam', keywords: ['vietnam'] },
      { emoji: '🇮🇩', name: 'Indonesia', keywords: ['indonesia'] },
      { emoji: '🇵🇭', name: 'Philippines', keywords: ['philippines'] },
      { emoji: '🇲🇾', name: 'Malaysia', keywords: ['malaysia'] },
      { emoji: '🇸🇬', name: 'Singapore', keywords: ['singapore'] },
      { emoji: '🇳🇿', name: 'New Zealand', keywords: ['nz'] },
      { emoji: '🇮🇪', name: 'Ireland', keywords: ['ireland'] },
      { emoji: '🇬🇷', name: 'Greece', keywords: ['greece'] },
      { emoji: '🇭🇺', name: 'Hungary', keywords: ['hungary'] },
      { emoji: '🇨🇿', name: 'Czech Republic', keywords: ['czech'] },
      { emoji: '🇷🇴', name: 'Romania', keywords: ['romania'] },
      { emoji: '🇺🇦', name: 'Ukraine', keywords: ['ukraine'] },
      { emoji: '🇮🇱', name: 'Israel', keywords: ['israel'] },
      { emoji: '🇸🇦', name: 'Saudi Arabia', keywords: ['saudi'] },
    ],
  },
];

// ---------------------------------------------------------------------------
// Recent emojis — persisted via localStorage
// ---------------------------------------------------------------------------

const RECENT_KEY = 'constchat-recent-emojis';
const MAX_RECENT = 32;

function getRecentEmojis(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function addRecentEmoji(emoji: string) {
  const recents = getRecentEmojis().filter((e) => e !== emoji);
  recents.unshift(emoji);
  if (recents.length > MAX_RECENT) recents.length = MAX_RECENT;
  localStorage.setItem(RECENT_KEY, JSON.stringify(recents));
}

// ---------------------------------------------------------------------------
// Skin tone helper
// ---------------------------------------------------------------------------

function applySkinTone(emoji: string, modifier: string): string {
  if (!modifier) return emoji;
  // Only apply to base emoji that support skin tones
  const baseEmoji = emoji.replace(/[\u{1F3FB}-\u{1F3FF}]/gu, '');
  if (SKIN_TONE_BASE.includes(baseEmoji)) {
    // Insert modifier after the first code point
    const codePoints = [...baseEmoji];
    if (codePoints.length > 0) {
      return codePoints[0] + modifier + codePoints.slice(1).join('');
    }
  }
  return emoji;
}

// ---------------------------------------------------------------------------
// Saved skin tone preference
// ---------------------------------------------------------------------------

const SKIN_TONE_KEY = 'constchat-skin-tone';

function getSavedSkinTone(): number {
  if (typeof window === 'undefined') return 0;
  return parseInt(localStorage.getItem(SKIN_TONE_KEY) ?? '0', 10);
}

function saveSkinTone(index: number) {
  localStorage.setItem(SKIN_TONE_KEY, String(index));
}

// ---------------------------------------------------------------------------
// EmojiPicker component
// ---------------------------------------------------------------------------

interface EmojiPickerProps {
  onSelect: (emoji: string, name: string) => void;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  placement?: 'top' | 'bottom';
  /** If provided, shows custom emojis for this guild */
  guildId?: string;
}

export function EmojiPicker({ onSelect, onClose, triggerRef, placement = 'top', guildId }: EmojiPickerProps) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('smileys');
  const [skinToneIndex, setSkinToneIndex] = useState(getSavedSkinTone);
  const [showSkinTones, setShowSkinTones] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  const pickerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const skinTone = SKIN_TONES[skinToneIndex]?.modifier ?? '';

  // Mount portal
  useEffect(() => {
    setMounted(true);
    // Focus search on open
    requestAnimationFrame(() => searchRef.current?.focus());
  }, []);

  // Position relative to trigger
  useEffect(() => {
    if (!triggerRef.current) return;
    const updatePos = () => {
      const rect = triggerRef.current!.getBoundingClientRect();
      const pickerWidth = 352;
      const pickerHeight = 420;

      let top: number;
      if (placement === 'top') {
        top = rect.top + window.scrollY - pickerHeight - 8;
        // If it would go above viewport, flip to bottom
        if (top < 8) top = rect.bottom + window.scrollY + 8;
      } else {
        top = rect.bottom + window.scrollY + 8;
      }

      let left = rect.left + window.scrollX + rect.width / 2 - pickerWidth / 2;
      // Clamp to viewport
      left = Math.max(8, Math.min(left, window.innerWidth - pickerWidth - 8));

      setPosition({ top, left });
    };
    updatePos();
    window.addEventListener('resize', updatePos);
    return () => window.removeEventListener('resize', updatePos);
  }, [triggerRef, placement]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, triggerRef]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Filter emojis by search
  const filteredCategories = useMemo(() => {
    if (!search.trim()) return null; // null = no search active
    const q = search.toLowerCase().trim();
    const results: EmojiEntry[] = [];
    for (const cat of CATEGORIES) {
      for (const e of cat.emojis) {
        if (
          e.name.toLowerCase().includes(q) ||
          e.keywords?.some((k) => k.includes(q))
        ) {
          results.push(e);
        }
      }
    }
    return results;
  }, [search]);

  const recentEmojis = useMemo(() => getRecentEmojis(), []);

  // Custom guild emojis
  const activeGuildId = guildId ?? useUIStore.getState().activeGuildId;
  const customEmojis = useGuildsStore(
    (s) => (activeGuildId && activeGuildId !== '@me' && activeGuildId !== 'me') ? s.customEmojis[activeGuildId] ?? [] : []
  );

  const handleSelect = useCallback(
    (emoji: string, name: string) => {
      const finalEmoji = applySkinTone(emoji, skinTone);
      addRecentEmoji(finalEmoji);
      onSelect(finalEmoji, name);
    },
    [onSelect, skinTone]
  );

  // Scroll to category
  const scrollToCategory = useCallback((id: string) => {
    setActiveCategory(id);
    const el = document.getElementById(`emoji-cat-${id}`);
    if (el && gridRef.current) {
      gridRef.current.scrollTo({ top: el.offsetTop - gridRef.current.offsetTop - 32, behavior: 'smooth' });
    }
  }, []);

  // Track active category on scroll
  const handleScroll = useCallback(() => {
    if (!gridRef.current || search) return;
    const scrollTop = gridRef.current.scrollTop + gridRef.current.offsetTop + 40;
    let current = 'smileys';
    for (const cat of CATEGORIES) {
      const el = document.getElementById(`emoji-cat-${cat.id}`);
      if (el && el.offsetTop <= scrollTop) {
        current = cat.id;
      }
    }
    if (recentEmojis.length > 0) {
      const recentEl = document.getElementById('emoji-cat-recent');
      if (recentEl && recentEl.offsetTop <= scrollTop) {
        // Don't override with recent once user scrolls past
      }
    }
    setActiveCategory(current);
  }, [search, recentEmojis.length]);

  if (!mounted || !position) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        ref={pickerRef}
        initial={{ opacity: 0, scale: 0.95, y: placement === 'top' ? 8 : -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: placement === 'top' ? 8 : -8 }}
        transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
        style={{
          position: 'absolute',
          top: position.top,
          left: position.left,
          zIndex: 'var(--z-popover, 50)',
          width: 352,
          height: 420,
          background: 'var(--color-surface-floating)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 12,
          boxShadow: 'var(--shadow-xl)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Search bar */}
        <div style={{ padding: '12px 12px 8px 12px' }}>
          <div
            className="flex items-center gap-2 rounded-lg px-3"
            style={{
              background: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border-subtle)',
              height: 36,
            }}
          >
            <Search size={14} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search emoji"
              className="flex-1 bg-transparent text-sm outline-none"
              style={{
                color: 'var(--color-text-primary)',
                caretColor: 'var(--color-accent-primary)',
              }}
              aria-label="Search emoji"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="flex items-center justify-center"
                style={{ color: 'var(--color-text-tertiary)' }}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Category tabs */}
        {!search && (
          <div
            className="flex items-center gap-0.5 px-2"
            style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
          >
            {customEmojis.length > 0 && (
              <CategoryTab
                icon={<Star size={15} />}
                label="Server Emoji"
                active={activeCategory === 'custom'}
                onClick={() => scrollToCategory('custom')}
              />
            )}
            {recentEmojis.length > 0 && (
              <CategoryTab
                icon={<Clock size={15} />}
                label="Recently Used"
                active={activeCategory === 'recent'}
                onClick={() => scrollToCategory('recent')}
              />
            )}
            {CATEGORIES.map((cat) => (
              <CategoryTab
                key={cat.id}
                icon={cat.icon}
                label={cat.name}
                active={activeCategory === cat.id}
                onClick={() => scrollToCategory(cat.id)}
              />
            ))}

            {/* Skin tone selector */}
            <div className="ml-auto relative">
              <button
                onClick={() => setShowSkinTones(!showSkinTones)}
                className="w-7 h-7 rounded-md flex items-center justify-center transition-colors duration-100"
                style={{
                  background: showSkinTones ? 'var(--color-surface-overlay)' : 'transparent',
                  fontSize: 16,
                }}
                aria-label="Skin tone"
                title="Skin tone"
              >
                {applySkinTone('👋', skinTone)}
              </button>

              {/* Skin tone dropdown */}
              {showSkinTones && (
                <div
                  className="absolute right-0 bottom-full mb-1 flex gap-1 p-1.5 rounded-lg"
                  style={{
                    background: 'var(--color-surface-floating)',
                    border: '1px solid var(--color-border-default)',
                    boxShadow: 'var(--shadow-lg)',
                    zIndex: 60,
                  }}
                >
                  {SKIN_TONES.map((tone, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setSkinToneIndex(i);
                        saveSkinTone(i);
                        setShowSkinTones(false);
                      }}
                      className="w-7 h-7 rounded-md flex items-center justify-center transition-colors duration-100"
                      style={{
                        background: i === skinToneIndex ? 'var(--color-accent-muted)' : 'transparent',
                        fontSize: 16,
                      }}
                      title={tone.label}
                      aria-label={`Skin tone: ${tone.label}`}
                    >
                      {applySkinTone('👋', tone.modifier)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Emoji grid */}
        <div
          ref={gridRef}
          className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-1"
          onScroll={handleScroll}
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--color-border-strong) transparent' }}
        >
          {/* Search results */}
          {filteredCategories !== null ? (
            filteredCategories.length > 0 ? (
              <div className="py-1">
                <p
                  className="text-xs font-semibold uppercase px-1 pb-1.5 pt-1"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  Search Results
                </p>
                <div className="grid gap-0.5" style={{ gridTemplateColumns: 'repeat(8, 1fr)' }}>
                  {filteredCategories.map((e) => (
                    <EmojiButton
                      key={e.emoji}
                      emoji={applySkinTone(e.emoji, skinTone)}
                      name={e.name}
                      onClick={() => handleSelect(e.emoji, e.name)}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <span style={{ fontSize: 32 }}>😅</span>
                <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                  No emoji found
                </p>
              </div>
            )
          ) : (
            <>
              {/* Custom server emojis */}
              {customEmojis.length > 0 && (
                <div id="emoji-cat-custom" className="py-1">
                  <p
                    className="text-xs font-semibold uppercase px-1 pb-1.5 pt-1 sticky top-0"
                    style={{
                      color: 'var(--color-text-tertiary)',
                      background: 'var(--color-surface-floating)',
                      zIndex: 1,
                    }}
                  >
                    Server Emoji
                  </p>
                  <div className="grid gap-0.5" style={{ gridTemplateColumns: 'repeat(8, 1fr)' }}>
                    {customEmojis.map((ce) => (
                      <button
                        key={ce.id}
                        onClick={() => onSelect(`:${ce.name}:`, ce.name)}
                        className="w-9 h-9 rounded-md flex items-center justify-center transition-colors duration-100"
                        style={{ fontSize: 22 }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--color-surface-overlay)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                        title={`:${ce.name}:`}
                        aria-label={ce.name}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={ce.url}
                          alt={ce.name}
                          className="w-6 h-6 object-contain"
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent emojis */}
              {recentEmojis.length > 0 && (
                <div id="emoji-cat-recent" className="py-1">
                  <p
                    className="text-xs font-semibold uppercase px-1 pb-1.5 pt-1 sticky top-0"
                    style={{
                      color: 'var(--color-text-tertiary)',
                      background: 'var(--color-surface-floating)',
                      zIndex: 1,
                    }}
                  >
                    Recently Used
                  </p>
                  <div className="grid gap-0.5" style={{ gridTemplateColumns: 'repeat(8, 1fr)' }}>
                    {recentEmojis.map((emoji, i) => (
                      <EmojiButton
                        key={`recent-${i}`}
                        emoji={emoji}
                        name={emoji}
                        onClick={() => handleSelect(emoji, emoji)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Category sections */}
              {CATEGORIES.map((cat) => (
                <div key={cat.id} id={`emoji-cat-${cat.id}`} className="py-1">
                  <p
                    className="text-xs font-semibold uppercase px-1 pb-1.5 pt-1 sticky top-0"
                    style={{
                      color: 'var(--color-text-tertiary)',
                      background: 'var(--color-surface-floating)',
                      zIndex: 1,
                    }}
                  >
                    {cat.name}
                  </p>
                  <div className="grid gap-0.5" style={{ gridTemplateColumns: 'repeat(8, 1fr)' }}>
                    {cat.emojis.map((e) => (
                      <EmojiButton
                        key={e.emoji}
                        emoji={applySkinTone(e.emoji, skinTone)}
                        name={e.name}
                        onClick={() => handleSelect(e.emoji, e.name)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CategoryTab({
  icon,
  label,
  active,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-8 h-8 rounded-md flex items-center justify-center transition-colors duration-100"
      style={{
        color: active ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
        background: active ? 'var(--color-surface-overlay)' : 'transparent',
        borderBottom: active ? '2px solid var(--color-accent-primary)' : '2px solid transparent',
        borderRadius: '6px 6px 0 0',
      }}
      title={label}
      aria-label={label}
      aria-selected={active}
      role="tab"
    >
      {icon}
    </button>
  );
}

function EmojiButton({
  emoji,
  name,
  onClick,
}: {
  emoji: string;
  name: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full aspect-square rounded-md flex items-center justify-center transition-colors duration-75 text-2xl"
      style={{ background: 'transparent' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--color-surface-overlay)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
      title={name}
      aria-label={name}
    >
      {emoji}
    </button>
  );
}
