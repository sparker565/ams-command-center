import { ROLES } from "./constants";

function normalizeEmail(email = "") {
  return String(email).trim().toLowerCase();
}

const APPROVED_AUTH_USERS = [
  {
    email: "sparker565@gmail.com",
    name: "Spark Command",
    role: ROLES.OWNER,
    companyName: "SparkCommand Systems",
    defaultPortal: "/owner",
  },
  {
    email: "shawnp@advancedmtnc.com",
    name: "Shawn Parker",
    role: ROLES.AMS_ADMIN,
    companyName: "AMS",
    defaultPortal: "/ams",
  },
  {
    email: "jeanniez@advancedmtnc.com",
    name: "Jeannie Z",
    role: ROLES.AMS_ADMIN,
    companyName: "AMS",
    defaultPortal: "/ams",
  },
  {
    email: "timr@advancedmtnc.com",
    name: "Tim Resler",
    role: ROLES.AMS_ADMIN,
    companyName: "AMS",
    defaultPortal: "/ams",
  },
  {
    email: "jeffr@advancedmtnc.com",
    name: "Jeff Resler",
    role: ROLES.AMS_ADMIN,
    companyName: "AMS",
    defaultPortal: "/ams",
  },
  {
    email: "ridgebacksi@yahoo.com",
    name: "Dan Botsch",
    role: ROLES.AMS_ADMIN,
    companyName: "AMS",
    defaultPortal: "/ams",
  },
  {
    email: "craigcarew@gmail.com",
    name: "Craig Carew",
    role: ROLES.VENDOR,
    companyName: "vendor",
    defaultPortal: "/crew",
  },
  {
    email: "abbyquinn@rocketmail.com",
    name: "Abby Quinn",
    role: ROLES.VENDOR,
    companyName: "vendor",
    defaultPortal: "/crew",
  },
];

export function getApprovedAuthUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  return (
    APPROVED_AUTH_USERS.find((user) => normalizeEmail(user.email) === normalizedEmail) || null
  );
}
