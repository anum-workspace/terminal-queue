#!/bin/bash
########################################################################
#              author:    Anum Hosen                                   #
#              email:     anumhosen@gmail.com                          #
#----------------------------------------------------------------------#
#                         Dept. of Physics                             #
#           Jashore University of Science and Technology               #
########################################################################

source /usr/local/gromacs/bin/GMXRC


total_steps=20
isbreak=false

########################################################################
#                      Find last completed step                        #
########################################################################
last_done=0
for i in $(seq 1 $total_steps); do
  if [ -f "step7_${i}.gro" ]; then
    last_done=$i
  else
    break
  fi
done

echo "Last completed step: step7_${last_done}"

########################################################################
#                      Find last break down step                       #
########################################################################
next_step=$((last_done + 1))

if [ -f "step7_${next_step}.cpt" ] && [ -f "step7_${next_step}_prev.cpt" ]; then
    echo "Last breakdown step is: step7_${next_step}"
    isbreak=true
    last_done=$next_step   # move forward properly
fi

########################################################################
#                    Continue from break down step                     #
########################################################################
if [ "$isbreak" = true ]; then
    echo "Running from breakdown step7_${last_done}..."
    ls -lh step7_${last_done}.cpt step7_${last_done}_prev.cpt

    gmx mdrun -s step7_${last_done}.tpr \
              -cpi step7_${last_done}.cpt \
              -v -deffnm step7_${last_done} \
              -ntmpi 1 \
              -ntomp 16 \
              -nb gpu \
              -pme gpu \
              -update gpu || { echo "mdrun failed at step7_$last_done"; exit 1; }
fi

########################################################################
#               If no steps completed, start from scratch              #
########################################################################
if [ "$last_done" -eq 0 ]; then
  echo "Starting from step7_1..."
  gmx grompp -f step7_production.mdp \
             -o step7_1.tpr \
             -c step6.6_equilibration.gro \
             -p topol.top \
             -n index.ndx || { echo "Initial grompp failed"; exit 1; }

  gmx mdrun -v -deffnm step7_1 \
            -ntmpi 1 \
            -ntomp 16 \
            -nb gpu \
            -pme gpu \
            -update gpu || { echo "Initial mdrun failed"; exit 1; }

  last_done=1
fi

########################################################################
#                       Continue from next step                        #
########################################################################
start=$((last_done + 1))

for i in $(seq $start $total_steps); do
  prev=$((i - 1))
  echo "Running step7_$i..."

  gmx grompp -f step7_production.mdp \
             -o step7_${i}.tpr \
             -c step7_${prev}.gro \
             -t step7_${prev}.cpt \
             -p topol.top \
             -n index.ndx || { echo "grompp failed at step7_$i"; exit 1; }

  gmx mdrun -v -deffnm step7_${i} \
            -ntmpi 1 \
            -ntomp 16 \
            -nb gpu \
            -pme gpu \
            -update gpu || { echo "mdrun failed at step7_$i"; exit 1; }
done

############################# THE END ##################################
