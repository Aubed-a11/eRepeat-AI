/* Contenu pédagogique : chapitres, leçons et générateurs d'exercices (niveau 3e, Bénin). */
var MINUS = '\u2212';
var rnd=function(a,b){return Math.floor(Math.random()*(b-a+1))+a;};
var pick=function(a){return a[Math.floor(Math.random()*a.length)];};
var shuffle=function(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}return a;};
var num=function(n){var r=Math.round(n*10)/10;return (r<0?MINUS:'')+String(Math.abs(r)).replace('.',',');};
var sg=function(n){return n<0?' '+MINUS+' '+Math.abs(n):' + '+n;};
var xt=function(a){return a===1?'x':a===-1?MINUS+'x':(a<0?MINUS+Math.abs(a):a)+'x';};


/* ---------- Contenu pédagogique ---------- */
var TAGS={methode:'Erreur de méthode',calcul:'Erreur de calcul',signe:'Erreur de signe',oubli:'Étape oubliée',notion:'Notion à revoir'};
var CH=[
 {id:'m_eq',subj:'Mathématiques',name:'Équations du premier degré',ic:'x'},
 {id:'m_calc',subj:'Mathématiques',name:'Calcul littéral',ic:'a'},
 {id:'m_pyth',subj:'Mathématiques',name:'Théorème de Pythagore',ic:'△'},
 {id:'f_fig',subj:'Français',name:'Figures de style',ic:'F'},
 {id:'f_conj',subj:'Français',name:'Conjugaison',ic:'C'}
];
var CHN=function(id){return CH.filter(function(c){return c.id===id;})[0];};
var LESSONS={
 m_eq:{title:'Isoler l’inconnue dans une équation',p:['Une équation est une égalité qui contient une valeur inconnue, souvent notée x. Pour la trouver, on fait la même opération des deux côtés de l’égalité.','On annule ce qui accompagne x avec l’opération inverse : le contraire de + est −, le contraire de × est ÷.'],ex:['x + 3 = 7','x + 3 − 3 = 7 − 3','x = 4'],steps:['Lis l’équation en entier.','Repère l’inconnue et ce qui l’accompagne.','Choisis l’opération inverse.','Fais-la des deux côtés.','Vérifie en remplaçant x par ta valeur.']},
 m_calc:{title:'Réduire et développer',p:['Réduire, c’est regrouper les termes semblables : 3x + 2x = 5x. On additionne les coefficients, x reste x.','Développer, c’est distribuer : k(x + m) = kx + km. Le facteur multiplie chaque terme de la parenthèse.'],ex:['3(x + 4)','3 × x + 3 × 4','3x + 12'],steps:['Repère les termes semblables.','Additionne leurs coefficients.','Pour développer, multiplie chaque terme de la parenthèse.','Fais attention aux signes.','Vérifie avec une valeur de x, par exemple x = 1.']},
 m_pyth:{title:'Le théorème de Pythagore',p:['Dans un triangle rectangle, le carré de l’hypoténuse est égal à la somme des carrés des deux autres côtés. L’hypoténuse est le côté en face de l’angle droit, le plus long.','Si BC est l’hypoténuse : BC² = AB² + AC².'],ex:['AB = 3 et AC = 4','BC² = 3² + 4² = 9 + 16 = 25','BC = 5'],steps:['Repère l’angle droit et l’hypoténuse.','Écris la relation de Pythagore.','Remplace par les valeurs.','Calcule, puis prends la racine carrée si on cherche une longueur.','Vérifie que l’hypoténuse reste le plus long côté.']},
 f_fig:{title:'Reconnaître les figures de style',p:['La comparaison rapproche deux éléments avec un mot de comparaison (comme, pareil à). La métaphore fait le même rapprochement sans ce mot.','La personnification donne des actions humaines à une chose. L’hyperbole exagère. L’antithèse oppose deux idées.'],ex:['Ses yeux brillent comme des étoiles : comparaison','Cet homme est un lion : métaphore','La mer caresse le sable : personnification'],steps:['Cherche un mot de comparaison.','Demande-toi si une chose agit comme une personne.','Repère une exagération.','Repère deux idées opposées.']},
 f_conj:{title:'Choisir le bon temps',p:['Le mot qui indique le moment (hier, demain, quand j’étais petit, si…) aide à choisir le temps.','Passé composé pour une action finie, imparfait pour une habitude passée, futur pour demain, conditionnel après « si » à l’imparfait, subjonctif après « il faut que ».'],ex:['Hier, nous sommes allés au marché : passé composé','Demain, tu finiras : futur','Il faut que tu fasses : subjonctif'],steps:['Repère l’indicateur de temps.','Identifie le sujet.','Choisis le temps.','Accorde le verbe avec le sujet.']}
};

function mk(o){
 var seen={};seen[o.correct]=1;var W=[];
 o.wrongs.forEach(function(w){if(!seen[w.t]){seen[w.t]=1;W.push(w);}});
 var k=1;while(W.length<3&&o.filler){var t=o.filler(k++);if(!seen[t]){seen[t]=1;W.push({t:t,tag:'calcul',why:'Vérifie ton calcul ligne par ligne.'});}if(k>12)break;}
 var all=shuffle([{t:o.correct,tag:null,why:''}].concat(W.slice(0,3)));
 return {chap:o.chap,level:o.level,q:o.q,sub:o.sub||'',opts:all.map(function(x){return x.t;}),ans:all.map(function(x){return x.tag===null;}).indexOf(true),tags:all.map(function(x){return x.tag;}),whys:all.map(function(x){return x.why;}),hints:o.hints,expl:o.expl,meta:o.meta||null};
}
var X=function(n){return 'x = '+num(n);};

function genEq(level){
 var v,b,c,a,d,q,wr,hints,expl,meta,type=level===1?pick(['p','m']):level===2?pick(['a','ab']):'abc';
 if(type==='p'){v=rnd(2,12);b=rnd(2,12);c=v+b;q='x + '+b+' = '+c;meta={a:1,b:b,c:c,d:0,v:v,l:'x',r:0};
  wr=[{t:X(c+b),tag:'methode',why:'Tu as ajouté '+b+' alors qu’il faut le retirer des deux côtés.'},{t:X(b-c),tag:'signe',why:'Tu as inversé les nombres : on calcule '+c+' '+MINUS+' '+b+', pas '+b+' '+MINUS+' '+c+'.'},{t:X(c),tag:'oubli',why:'Tu as recopié le second membre sans isoler x : il reste à retirer '+b+'.'}];
  hints=['Repère ce qui est ajouté à x. Pour laisser x seul, il faut annuler cette opération.','Pour annuler « + '+b+' », retire '+b+' des deux côtés de l’égalité.','Première étape : x + '+b+' '+MINUS+' '+b+' = '+c+' '+MINUS+' '+b+'. Calcule ensuite '+c+' '+MINUS+' '+b+'.'];
  expl='On retire '+b+' des deux côtés : x = '+c+' '+MINUS+' '+b+' = '+v+'. Vérification : '+v+' + '+b+' = '+c+'.';}
 else if(type==='m'){v=rnd(8,18);b=rnd(2,7);c=v-b;q='x '+MINUS+' '+b+' = '+c;meta={a:1,b:-b,c:c,d:0,v:v};
  wr=[{t:X(c-b),tag:'methode',why:'Tu as retiré '+b+' une seconde fois : pour annuler « '+MINUS+' '+b+' », on ajoute '+b+'.'},{t:X(b-c),tag:'signe',why:'Tu as inversé les nombres de la soustraction.'},{t:X(c),tag:'oubli',why:'Il reste à ajouter '+b+' des deux côtés pour isoler x.'}];
  hints=['Repère ce qui est retiré à x. Quelle opération l’annule ?','Pour annuler « '+MINUS+' '+b+' », ajoute '+b+' des deux côtés.','Première étape : x '+MINUS+' '+b+' + '+b+' = '+c+' + '+b+'. Calcule '+c+' + '+b+'.'];
  expl='On ajoute '+b+' des deux côtés : x = '+c+' + '+b+' = '+v+'. Vérification : '+v+' '+MINUS+' '+b+' = '+c+'.';}
 else if(type==='a'){a=rnd(2,9);v=rnd(2,12);c=a*v;q=a+'x = '+c;meta={a:a,b:0,c:c,d:0,v:v};
  wr=[{t:X(c*a),tag:'methode',why:'Tu as multiplié par '+a+' : pour annuler une multiplication, on divise.'},{t:X(c-a),tag:'methode',why:'Tu as soustrait '+a+' : '+a+'x signifie '+a+' fois x, il faut diviser par '+a+'.'},{t:X(c+a),tag:'methode',why:'Tu as additionné '+a+' : il faut diviser par '+a+'.'}];
  hints=['Ici, x est multiplié par un nombre. Quelle opération annule une multiplication ?',' Divise les deux côtés par '+a+'.','Première étape : '+a+'x ÷ '+a+' = '+c+' ÷ '+a+'. Calcule '+c+' ÷ '+a+'.'];
  hints[1]=hints[1].trim();
  expl='On divise par '+a+' des deux côtés : x = '+c+' ÷ '+a+' = '+v+'. Vérification : '+a+' × '+v+' = '+c+'.';}
 else if(type==='ab'){a=rnd(2,6);v=rnd(2,9);b=rnd(1,9);c=a*v+b;q=a+'x + '+b+' = '+c;meta={a:a,b:b,c:c,d:0,v:v};
  wr=[{t:X(c-b),tag:'oubli',why:'Tu as retiré '+b+' mais tu as oublié de diviser par '+a+'.'},{t:X((c+b)/a),tag:'signe',why:'Tu as ajouté '+b+' au lieu de le retirer.'},{t:X(c/a-b),tag:'methode',why:'Il faut d’abord retirer '+b+', puis diviser le résultat par '+a+'. Tu as divisé en premier.'}];
  hints=['Il y a deux opérations autour de x. On les annule dans l’ordre inverse : d’abord le + '+b+', ensuite la multiplication.','Retire '+b+' des deux côtés : '+a+'x = '+c+' '+MINUS+' '+b+'.','Il reste '+a+'x = '+(c-b)+'. Divise maintenant par '+a+'.'];
  expl='On retire '+b+' : '+a+'x = '+(c-b)+'. On divise par '+a+' : x = '+v+'. Vérification : '+a+' × '+v+' + '+b+' = '+c+'.';}
 else{c=rnd(1,4);a=c+rnd(2,5);v=rnd(2,8);b=rnd(1,9);d=(a-c)*v+b;
  q=xt(a)+sg(b)+' = '+xt(c)+sg(d);meta={a:a,b:b,c:c,d:d,v:v};
  wr=[{t:X((d+b)/(a-c)),tag:'signe',why:'Tu as ajouté '+b+' au lieu de le passer de l’autre côté en le retirant.'},{t:X((d-b)/(a+c)),tag:'methode',why:'Pour regrouper les x, on retire '+c+'x des deux côtés, on n’additionne pas '+c+' et '+a+'.'},{t:X((b-d)/(a-c)),tag:'signe',why:'Tu as inversé le signe du second membre : on calcule '+d+' '+MINUS+' '+b+'.'}];
  hints=['Il y a des x des deux côtés. Commence par les regrouper du même côté.','Retire '+c+'x des deux côtés, puis retire '+b+' des deux côtés.','Tu obtiens '+(a-c)+'x = '+d+' '+MINUS+' '+b+'. Calcule le second membre puis divise par '+(a-c)+'.'];
  expl='On regroupe : '+(a-c)+'x = '+d+' '+MINUS+' '+b+' = '+(d-b)+'. Donc x = '+v+'. Vérification : '+(a*v+b)+' = '+(c*v+d)+'.';}
 return mk({chap:'m_eq',level:level,q:q,sub:'Résous l’équation.',correct:X(v),wrongs:wr,filler:function(k){return X(v+(k%2?k:-k));},hints:hints,expl:expl,meta:meta});
}
function genCalc(level){
 var q,correct,wr,hints,expl,sub='',a,b,k,m,p,r;
 if(level===1){a=rnd(2,9);b=rnd(2,9);q=xt(a)+' + '+xt(b);sub='Réduis l’expression.';correct=(a+b)+'x';
  wr=[{t:(a+b)+'x²',tag:'notion',why:'On additionne seulement les coefficients : x reste x, il ne devient pas x².'},{t:(a*b)+'x',tag:'methode',why:'Tu as multiplié les coefficients : on les additionne.'},{t:(a+b)+'x + '+(a+b),tag:'notion',why:'Il n’y a qu’un seul type de terme ici : le résultat est un seul terme en x.'}];
  hints=['Les deux termes sont semblables : ils contiennent tous les deux x.','On additionne les coefficients et on garde x.','Calcule '+a+' + '+b+' puis écris x derrière.'];
  expl=a+'x + '+b+'x = ('+a+' + '+b+')x = '+(a+b)+'x. Vérification avec x = 1 : '+a+' + '+b+' = '+(a+b)+'.';}
 else if(level===2){k=rnd(2,9);m=rnd(2,9);var neg=Math.random()<.4;
  q=k+'(x '+(neg?MINUS:'+')+' '+m+')';sub='Développe l’expression.';
  correct=k+'x '+(neg?MINUS:'+')+' '+(k*m);
  wr=[{t:k+'x '+(neg?MINUS:'+')+' '+m,tag:'oubli',why:'Tu as oublié de multiplier le second terme par '+k+'.'},{t:'x '+(neg?MINUS:'+')+' '+(k*m),tag:'oubli',why:'Tu as oublié de multiplier x par '+k+'.'},{t:neg?k+'x + '+(k*m):k+'x '+MINUS+' '+(k*m),tag:'signe',why:'Le signe à l’intérieur de la parenthèse reste le même après distribution.'}];
  hints=['Le nombre devant la parenthèse multiplie chaque terme à l’intérieur.','Écris : '+k+' × x puis '+k+' × '+m+', en gardant le signe.','Calcule '+k+' × '+m+'.'];
  expl=k+'(x '+(neg?MINUS:'+')+' '+m+') = '+k+'x '+(neg?MINUS:'+')+' '+k+' × '+m+' = '+correct+'. Vérification avec x = 1 : '+k*(neg?1-m:1+m)+' = '+(neg?k-k*m:k+k*m)+'.';}
 else{p=rnd(1,6);r=rnd(2,7);q='(x + '+p+')(x + '+r+')';sub='Développe puis réduis.';
  correct='x² + '+(p+r)+'x + '+(p*r);
  wr=[{t:'x² + '+(p*r),tag:'oubli',why:'Tu as oublié les termes croisés : x × '+r+' et '+p+' × x.'},{t:'x² + '+(p+r)+'x + '+(p+r),tag:'calcul',why:'Le dernier terme est un produit : '+p+' × '+r+', pas une somme.'},{t:'x² + '+(p*r)+'x + '+(p+r),tag:'methode',why:'Les rôles sont inversés : les x s’additionnent ('+p+' + '+r+'), les nombres se multiplient.'}];
  hints=['Chaque terme de la première parenthèse multiplie chaque terme de la seconde : il y a quatre produits.','x × x, x × '+r+', '+p+' × x, '+p+' × '+r+'.','Regroupe les deux termes en x : '+r+'x + '+p+'x.'];
  expl='(x + '+p+')(x + '+r+') = x² + '+r+'x + '+p+'x + '+(p*r)+' = '+correct+'. Vérification avec x = 1 : '+((1+p)*(1+r))+' = '+(1+p+r+p*r)+'.';}
 return mk({chap:'m_calc',level:level,q:q,sub:sub,correct:correct,wrongs:wr,filler:function(k2){return correct+' '+(k2%2?'+':MINUS)+' '+k2;},hints:hints,expl:expl});
}
var TRI=[[3,4,5],[5,12,13],[8,15,17],[6,8,10],[9,12,15],[7,24,25],[20,21,29],[12,16,20]];
function genPyth(level){
 var t=pick(TRI),a=t[0],b=t[1],c=t[2],q,sub,correct,wr,hints,expl;
 if(level<3){if(Math.random()<.5){var s=a;a=b;b=s;}
  q='Le triangle ABC est rectangle en A. AB = '+a+' cm et AC = '+b+' cm.';sub='Calcule BC.';correct=c+' cm';
  wr=[{t:(a+b)+' cm',tag:'methode',why:'Tu as additionné les côtés : il faut additionner leurs carrés.'},{t:(a*a+b*b)+' cm',tag:'oubli',why:'Tu as oublié la racine carrée : BC² = '+(a*a+b*b)+', donc BC est la racine de ce nombre.'},{t:(c-1)+' cm',tag:'calcul',why:'Vérifie le calcul de BC² puis sa racine carrée.'}];
  hints=['Repère l’hypoténuse : le côté en face de l’angle droit. Ici, c’est BC.','Écris BC² = AB² + AC².','BC² = '+a+'² + '+b+'² = '+(a*a)+' + '+(b*b)+'. Cherche le nombre dont le carré vaut '+(a*a+b*b)+'.'];
  expl='BC² = AB² + AC² = '+a+'² + '+b+'² = '+(a*a+b*b)+', donc BC = '+c+' cm.';}
 else{q='Le triangle ABC est rectangle en A. BC = '+c+' cm et AB = '+a+' cm.';sub='Calcule AC.';correct=b+' cm';
  wr=[{t:(c-a)+' cm',tag:'methode',why:'Tu as soustrait les longueurs : il faut soustraire les carrés.'},{t:(c*c-a*a)+' cm',tag:'oubli',why:'Tu as oublié la racine carrée : AC² = '+(c*c-a*a)+'.'},{t:(c+a)+' cm',tag:'notion',why:'Un côté de l’angle droit est plus court que l’hypoténuse.'}];
  hints=['BC est l’hypoténuse : c’est le plus grand côté. On cherche un côté de l’angle droit.','Écris AC² = BC² '+MINUS+' AB².','AC² = '+c+'² '+MINUS+' '+a+'² = '+(c*c)+' '+MINUS+' '+(a*a)+'. Cherche la racine carrée.'];
  expl='AC² = BC² '+MINUS+' AB² = '+(c*c)+' '+MINUS+' '+(a*a)+' = '+(b*b)+', donc AC = '+b+' cm.';}
 return mk({chap:'m_pyth',level:level,q:q,sub:sub,correct:correct,wrongs:wr,filler:function(k){return (c+k)+' cm';},hints:hints,expl:expl});
}
var FIG=[
 [1,'Ses yeux brillent comme des étoiles.','comparaison',['métaphore','personnification','antithèse'],'Cherche un mot qui rapproche deux choses.','Ici, « comme » relie les yeux et les étoiles : c’est un mot de comparaison.'],
 [1,'Cet homme est un lion au combat.','métaphore',['comparaison','hyperbole','antithèse'],'Y a-t-il un mot de comparaison (comme, pareil à) ?','Le rapprochement est direct, sans mot de comparaison : c’est une métaphore.'],
 [2,'La mer caressait doucement le sable.','personnification',['comparaison','métaphore','antithèse'],'Qui fait l’action de caresser d’habitude ?','Caresser est une action humaine donnée à la mer : personnification.'],
 [2,'J’ai attendu une éternité devant la porte.','hyperbole',['comparaison','personnification','antithèse'],'L’attente a-t-elle vraiment duré une éternité ?','Le mot « éternité » exagère la durée : hyperbole.'],
 [3,'Il est petit par la taille, mais grand par le cœur.','antithèse',['hyperbole','comparaison','personnification'],'Cherche deux idées contraires dans la phrase.','« petit » et « grand » s’opposent : antithèse.'],
 [3,'Pauvre en argent, riche en bonté, il partageait tout.','antithèse',['métaphore','hyperbole','comparaison'],'Quels mots s’opposent dans la phrase ?','« pauvre » et « riche » s’opposent : antithèse.']
];
var CON=[
 [1,'Hier, nous ____ (aller) au marché.','sommes allés',['allons','irons','allions'],'Le mot « hier » indique une action passée et terminée.','Action finie dans le passé : passé composé, « nous sommes allés ».'],
 [1,'Demain, tu ____ (finir) tes devoirs.','finiras',['finis','as fini','finissais'],'Le mot « demain » indique le futur.','Après « demain », on emploie le futur : « tu finiras ».'],
 [2,'Quand j’étais petit, je ____ (jouer) dehors chaque jour.','jouais',['ai joué','jouerai','joue'],'« Chaque jour » exprime une habitude dans le passé.','Une habitude passée se met à l’imparfait : « je jouais ».'],
 [2,'Si j’avais le temps, je ____ (venir) te voir.','viendrais',['viendrai','viens','venais'],'Après « si » à l’imparfait, quel temps exprime ce qui pourrait arriver ?','« Si » + imparfait appelle le conditionnel : « je viendrais ».'],
 [3,'Il faut que tu ____ (faire) tes devoirs.','fasses',['fais','feras','ferais'],'Après « il faut que », on utilise un mode particulier.','« Il faut que » est suivi du subjonctif : « que tu fasses ».'],
 [3,'Les élèves ____ (écrire) une dictée hier soir.','ont écrit',['écrivent','écriront','auraient écrit'],'« Hier soir » : l’action est passée et terminée.','Action terminée dans le passé : passé composé, « ont écrit ».']
];
function genStatic(bank,chap,level,why){
 var pool=bank.filter(function(r){return r[0]===level;});if(!pool.length)pool=bank;
 var r=pick(pool);
 var wr=r[3].map(function(t){return {t:t,tag:'notion',why:why};});
 return mk({chap:chap,level:level,q:r[1],sub:chap==='f_fig'?'Quelle est la figure de style ?':'Choisis la bonne forme.',correct:r[2],wrongs:wr,hints:[r[4],'Rappelle-toi la leçon : '+(chap==='f_fig'?'comparaison avec « comme », métaphore sans mot de comparaison.':'l’indicateur de temps guide le choix.'),r[5].split(':')[0]+'…'],expl:r[5]});
}
function gen(chap,level){
 level=Math.max(1,Math.min(3,level));
 if(chap==='m_eq')return genEq(level);
 if(chap==='m_calc')return genCalc(level);
 if(chap==='m_pyth')return genPyth(level);
 if(chap==='f_fig')return genStatic(FIG,chap,level,'Cette figure ne correspond pas : relis la définition de chaque figure.');
 return genStatic(CON,chap,level,'Ce temps ne correspond pas à l’indicateur de la phrase.');
}


export { TAGS, CH, CHN, LESSONS, gen, num };
