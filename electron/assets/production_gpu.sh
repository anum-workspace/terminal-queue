#!/bin/bash
########################################################################
#              author:    Anum Hosen                                   #
#              email:     anumhosen@gmail.com                          #
#----------------------------------------------------------------------#
#                         Dept. of Physics                             #
#           Jashore University of Science and Technology               #
########################################################################
set -e
source /usr/local/gromacs/bin/GMXRC

# Initial production step
gmx grompp -f step7_production.mdp \
           -o step7_1.tpr \
           -c step6.6_equilibration.gro \
           -p topol.top \
           -n index.ndx
           
gmx mdrun -v -deffnm step7_1 \
          -ntmpi 1 \
          -ntomp 16 \
          -nb gpu \
          -pme gpu \
          -update gpu \
          -pin on

# Subsequent production steps (step7_2 to step7_10)
for i in {2..10}; do
  prev=$((i-1))
  gmx grompp -f step7_production.mdp \
             -o step7_${i}.tpr \
             -c step7_${prev}.gro \
             -t step7_${prev}.cpt \
             -p topol.top \
             -n index.ndx
             
  gmx mdrun -v -deffnm step7_${i} \
            -ntmpi 1 \
            -ntomp 16 \
            -nb gpu \
            -pme gpu \
            -update gpu \
            -pin on
done
