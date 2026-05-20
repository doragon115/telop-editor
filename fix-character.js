const fs=require("fs");

const f="src/components/CharacterLayer.tsx";

let s=fs.readFileSync(f,"utf8");

s=s.replace(
/const scale[\s\S]*?;/g,
"const scale = 2.8;"
);

s=s.replace(
/const opacity[\s\S]*?;/g,
"const opacity = 1;"
);

s=s.replace(
/transform:[^,]+,/g,
"transform:'none',"
);

s=s.replace(
/left:[^,]+,/g,
"left:20,"
);

s=s.replace(
/top:[^,]+,/g,
"top:'auto',"
);

s=s.replace(
/bottom:[^,]+,/g,
"bottom:30,"
);

s=s.replace(
/translateX\([^)]+\)/g,
""
);

s=s.replace(
/translateY\([^)]+\)/g,
""
);

s=s.replace(
/rotate\([^)]+\)/g,
""
);

/charHeight:\s*\d+/g.test(s)
&&(s=s.replace(/charHeight:\s*\d+/g,"charHeight:120"));

/catHeight:\s*\d+/g.test(s)
&&(s=s.replace(/catHeight:\s*\d+/g,"catHeight:90"));

fs.writeFileSync(f,s);

console.log("OK");
